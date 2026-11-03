<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\OfferCampaignMail;
use App\Models\Offer;
use App\Models\OfferCampaign;
use App\Models\OfferCampaignRecipient;
use App\Models\MarketingContact;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OfferController extends Controller
{
    public function validateCode(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40'], 'subtotal' => ['required', 'numeric', 'min:0']]);
        $offer = Offer::whereRaw('UPPER(code) = ?', [Str::upper(trim($data['code']))])->where('status', 'active')->first();
        $subtotal = (float) $data['subtotal'];
        $valid = $offer && (!$offer->starts_at || $offer->starts_at->isPast()) && (!$offer->ends_at || $offer->ends_at->isFuture())
            && (!$offer->usage_limit || $offer->usage_count < $offer->usage_limit) && $subtotal >= (float) $offer->minimum_subtotal;
        if (!$valid) return response()->json(['success' => true, 'data' => ['valid' => false, 'message' => 'This offer code is invalid, expired, or does not meet the minimum spend.']]);
        $discount = $offer->discount_type === 'percentage' ? $subtotal * (float) $offer->discount_value / 100 : (float) $offer->discount_value;
        if ($offer->maximum_discount) $discount = min($discount, (float) $offer->maximum_discount);
        $discount = round(min($subtotal, $discount), 2);
        return response()->json(['success' => true, 'data' => ['valid' => true, 'code' => $offer->code, 'name' => $offer->name, 'discount_amount' => $discount]]);
    }

    public function index(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => Offer::withCount('campaigns')->latest()->get()]);
    }

    public function customers(Request $request): JsonResponse
    {
        $query = User::query()->where('role', User::ROLE_CUSTOMER)->whereNotNull('email')->where('email', 'not like', '%@erryimprints.internal')->whereNull('marketing_unsubscribed_at');
        if ($term = trim((string) $request->query('search', ''))) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"));
        }
        return response()->json(['success' => true, 'data' => $query->orderBy('name')->limit(500)->get(['id', 'name', 'email', 'marketing_consent'])]);
    }

    public function contacts(): JsonResponse
    {
        $contacts = MarketingContact::where('marketing_consent', true)->whereNull('unsubscribed_at')->orderBy('name')->get(['id', 'name', 'email']);
        return response()->json(['success' => true, 'data' => $contacts]);
    }

    public function storeContact(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email', 'max:255'],
            'confirm_consent' => ['required', 'accepted'],
        ]);
        $email = Str::lower(trim($data['email']));
        if (User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw ValidationException::withMessages(['email' => ['This email belongs to a customer account. Select that customer from the customer list instead.']]);
        }
        $contact = MarketingContact::updateOrCreate(['email' => $email], [
            'name' => trim($data['name']), 'marketing_consent' => true, 'marketing_consent_at' => now(),
            'unsubscribed_at' => null, 'created_by' => $request->user()->id,
        ]);
        return response()->json(['success' => true, 'data' => $contact], $contact->wasRecentlyCreated ? 201 : 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'code' => ['required', 'alpha_dash', 'max:40', 'unique:offers,code'],
            'discount_type' => ['required', 'in:percentage,fixed'], 'discount_value' => ['required', 'numeric', 'gt:0'],
            'minimum_subtotal' => ['nullable', 'numeric', 'min:0'], 'maximum_discount' => ['nullable', 'numeric', 'gt:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'], 'starts_at' => ['nullable', 'date'], 'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        if ($data['discount_type'] === 'percentage' && $data['discount_value'] > 100) {
            throw ValidationException::withMessages(['discount_value' => ['Percentage discount cannot exceed 100%.']]);
        }
        $data['code'] = Str::upper($data['code']);
        $data['status'] = 'active';
        $data['created_by'] = $request->user()->id;
        $offer = Offer::create($data);
        return response()->json(['success' => true, 'data' => $offer], 201);
    }

    public function campaign(Request $request, Offer $offer): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:180'], 'headline' => ['required', 'string', 'max:180'],
            'message' => ['required', 'string', 'max:5000'], 'customer_ids' => ['nullable', 'array', 'max:500'],
            'customer_ids.*' => ['integer', 'distinct'], 'contact_ids' => ['nullable', 'array', 'max:500'],
            'contact_ids.*' => ['integer', 'distinct'], 'all_consented' => ['nullable', 'boolean'],
            'confirm_consent' => ['required', 'accepted'],
        ]);

        $query = User::query()->where('role', User::ROLE_CUSTOMER)->whereNotNull('email')->where('email', 'not like', '%@erryimprints.internal')->whereNull('marketing_unsubscribed_at');
        if (!empty($data['all_consented'])) {
            $users = $query->where('marketing_consent', true)->limit(5000)->get();
            $contacts = MarketingContact::where('marketing_consent', true)->whereNull('unsubscribed_at')->limit(5000)->get();
        } else {
            $ids = $data['customer_ids'] ?? [];
            $contactIds = $data['contact_ids'] ?? [];
            if (!$ids && !$contactIds) throw ValidationException::withMessages(['customer_ids' => ['Select at least one customer or add recipient.']]);
            $users = $ids ? $query->whereIn('id', $ids)->get() : collect();
            if ($users->count() !== count(array_unique($ids))) throw ValidationException::withMessages(['customer_ids' => ['Some selected contacts are unavailable or have unsubscribed.']]);
            $users->where('marketing_consent', false)->each(function (User $user) {
                $user->update(['marketing_consent' => true, 'marketing_consent_at' => now()]);
            });
            $contacts = $contactIds ? MarketingContact::whereIn('id', $contactIds)->whereNull('unsubscribed_at')->get() : collect();
            if ($contacts->count() !== count(array_unique($contactIds))) throw ValidationException::withMessages(['contact_ids' => ['Some selected email recipients are unavailable or unsubscribed.']]);
        }
        $recipients = $users->map(fn (User $user) => ['model' => $user, 'kind' => 'user'])->concat($contacts->map(fn (MarketingContact $contact) => ['model' => $contact, 'kind' => 'contact']))
            ->unique(fn ($recipient) => Str::lower($recipient['model']->email))->values();
        if ($recipients->isEmpty()) throw ValidationException::withMessages(['recipients' => ['No eligible email recipients are available.']]);

        $campaign = OfferCampaign::create([
            'offer_id' => $offer->id, 'subject' => $data['subject'], 'headline' => $data['headline'],
            'message' => $data['message'], 'status' => 'sending', 'recipient_count' => $recipients->count(), 'created_by' => $request->user()->id,
        ]);
        $sent = 0; $failed = 0;
        foreach ($recipients->chunk(50) as $chunk) {
            foreach ($chunk as $entry) {
                $person = $entry['model'];
                $token = Str::random(64);
                $recipient = OfferCampaignRecipient::create([
                    'campaign_id' => $campaign->id, 'user_id' => $entry['kind'] === 'user' ? $person->id : null,
                    'marketing_contact_id' => $entry['kind'] === 'contact' ? $person->id : null, 'email' => $person->email,
                    'unsubscribe_token_hash' => hash('sha256', $token), 'status' => 'queued',
                ]);
                try {
                    $unsubscribeUrl = rtrim(config('app.url'), '/') . '/api/v1/offers/unsubscribe/' . $token;
                    Mail::to($person->email)->send(new OfferCampaignMail($campaign->loadMissing('offer'), $unsubscribeUrl));
                    $recipient->update(['status' => 'sent', 'sent_at' => now()]); $sent++;
                } catch (\Throwable $e) {
                    report($e); $recipient->update(['status' => 'failed', 'error' => Str::limit($e->getMessage(), 1000)]); $failed++;
                }
            }
        }
        $campaign->update(['status' => $failed === $recipients->count() ? 'failed' : 'sent', 'sent_count' => $sent, 'failed_count' => $failed, 'sent_at' => now()]);
        return response()->json(['success' => true, 'data' => $campaign->fresh(), 'message' => "Campaign complete: {$sent} sent, {$failed} failed."]);
    }

    public function unsubscribePage(string $token)
    {
        OfferCampaignRecipient::where('unsubscribe_token_hash', hash('sha256', $token))->firstOrFail();
        $action = route('offers.unsubscribe', ['token' => $token]);
        return response('<!doctype html><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><main style="font:16px Arial;max-width:560px;margin:12vh auto;padding:24px"><h1>Unsubscribe from promotions</h1><p>Confirm to stop receiving promotional emails from Erry Imprints.</p><form method="post" action="' . e($action) . '"><button style="background:#111827;color:#fff;border:0;border-radius:8px;padding:12px 18px;font-size:16px">Confirm unsubscribe</button></form></main>')->header('Content-Type', 'text/html');
    }

    public function unsubscribe(string $token)
    {
        $recipient = OfferCampaignRecipient::where('unsubscribe_token_hash', hash('sha256', $token))->firstOrFail();
        if ($recipient->user_id) User::whereKey($recipient->user_id)->update(['marketing_consent' => false, 'marketing_unsubscribed_at' => now()]);
        if ($recipient->marketing_contact_id) MarketingContact::whereKey($recipient->marketing_contact_id)->update(['marketing_consent' => false, 'unsubscribed_at' => now()]);
        return response('<!doctype html><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><main style="font:16px Arial;max-width:560px;margin:15vh auto;padding:24px"><h1>You are unsubscribed</h1><p>You will no longer receive promotional emails from Erry Imprints.</p></main>')->header('Content-Type', 'text/html');
    }
}
