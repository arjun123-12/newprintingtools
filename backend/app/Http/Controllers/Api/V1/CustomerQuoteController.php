<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CustomerEnquiry;
use App\Models\CustomerQuote;
use App\Services\CustomerQuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CustomerQuoteController extends Controller
{
    public function __construct(protected CustomerQuoteService $quotes) {}

    public function adminIndex(Request $request, string $enquiryId): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $enquiry = CustomerEnquiry::findOrFail($enquiryId);
        $quotes = CustomerQuote::where('customer_enquiry_id', $enquiry->id)->latest()->get()
            ->map(fn (CustomerQuote $quote) => [
                'id' => $quote->id,
                'quote_number' => $quote->quote_number,
                'recipient_name' => $quote->recipient_name,
                'recipient_email' => $quote->recipient_email,
                'status' => $quote->status,
                'total_inc_gst' => $quote->total_inc_gst,
                'currency' => $quote->currency,
                'expires_at' => $quote->expires_at?->toIso8601String(),
                'order_id' => $quote->order_id,
            ]);
        return response()->json(['success' => true, 'data' => $quotes]);
    }

    public function adminQuotes(Request $request): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $quotes = CustomerQuote::with('enquiry:id,name')->latest()->limit(250)->get()->map(fn (CustomerQuote $quote) => [
            'id' => $quote->id,
            'quote_number' => $quote->quote_number,
            'recipient_name' => $quote->recipient_name,
            'recipient_email' => $quote->recipient_email,
            'enquiry_name' => $quote->enquiry?->name,
            'customer_enquiry_id' => $quote->customer_enquiry_id,
            'status' => $quote->status,
            'items' => $quote->items,
            'delivery_method' => $quote->delivery_method,
            'delivery_address' => $quote->delivery_address,
            'terms' => $quote->terms,
            'subtotal_ex_gst' => (float) $quote->subtotal_ex_gst,
            'shipping_fee_inc_gst' => (float) $quote->shipping_fee_inc_gst,
            'gst_amount' => (float) $quote->gst_amount,
            'total_inc_gst' => (float) $quote->total_inc_gst,
            'currency' => $quote->currency,
            'expires_at' => $quote->expires_at?->toIso8601String(),
            'accepted_at' => $quote->accepted_at?->toIso8601String(),
            'declined_at' => $quote->declined_at?->toIso8601String(),
            'created_at' => $quote->created_at?->toIso8601String(),
            'order_id' => $quote->order_id,
        ]);
        return response()->json(['success' => true, 'data' => $quotes]);
    }

    public function adminShow(Request $request, string $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $quote = CustomerQuote::with('enquiry:id,name')->findOrFail($id);
        return response()->json([
            'success' => true,
            'data' => [
                'id' => $quote->id,
                'quote_number' => $quote->quote_number,
                'recipient_name' => $quote->recipient_name,
                'recipient_email' => $quote->recipient_email,
                'enquiry_name' => $quote->enquiry?->name,
                'customer_enquiry_id' => $quote->customer_enquiry_id,
                'status' => $quote->status,
                'items' => $quote->items,
                'delivery_method' => $quote->delivery_method,
                'delivery_address' => $quote->delivery_address,
                'terms' => $quote->terms,
                'subtotal_ex_gst' => (float) $quote->subtotal_ex_gst,
                'shipping_fee_inc_gst' => (float) $quote->shipping_fee_inc_gst,
                'gst_amount' => (float) $quote->gst_amount,
                'total_inc_gst' => (float) $quote->total_inc_gst,
                'currency' => $quote->currency,
                'expires_at' => $quote->expires_at?->toIso8601String(),
                'accepted_at' => $quote->accepted_at?->toIso8601String(),
                'declined_at' => $quote->declined_at?->toIso8601String(),
                'created_at' => $quote->created_at?->toIso8601String(),
                'order_id' => $quote->order_id,
            ],
        ]);
    }

    public function adminUpdate(Request $request, string $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $quote = CustomerQuote::findOrFail($id);
        $data = $request->validate($this->quoteRules());
        $resendEmail = filter_var($request->input('resend_email', false), FILTER_VALIDATE_BOOLEAN);

        try {
            $updated = $this->quotes->updateQuote($quote, $data, $resendEmail);
            return response()->json([
                'success' => true,
                'message' => $resendEmail
                    ? ($updated->email_sent ? 'Quote updated and resent to customer.' : 'Quote updated, but email could not be delivered.')
                    : 'Quote updated successfully.',
                'data' => [
                    'id' => $updated->id,
                    'quote_number' => $updated->quote_number,
                    'status' => $updated->status,
                    'total_inc_gst' => (float) $updated->total_inc_gst,
                    'currency' => $updated->currency,
                    'expires_at' => $updated->expires_at?->toIso8601String(),
                    'quote_url' => $updated->quote_url ?? null,
                    'email_sent' => $updated->email_sent ?? false,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Unable to update customer quote: ' . $e->getMessage(), ['quote_id' => $quote->id]);
            return response()->json(['success' => false, 'message' => 'Unable to update this quote. Please check the details and try again.'], 422);
        }
    }

    public function adminUpdateStatus(Request $request, string $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $data = $request->validate([
            'status' => ['required', 'string', 'in:draft,sent,accepted,declined,expired'],
        ]);
        $quote = CustomerQuote::findOrFail($id);
        $quote->update(['status' => $data['status']]);
        return response()->json([
            'success' => true,
            'message' => "Quote status updated to {$data['status']}.",
            'data' => ['id' => $quote->id, 'status' => $quote->status],
        ]);
    }

    public function adminDestroy(Request $request, string $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $quote = CustomerQuote::findOrFail($id);
        if ($quote->order_id) {
            return response()->json(['success' => false, 'message' => 'Cannot delete a quote that has already been converted to an order.'], 422);
        }
        $quote->delete();
        return response()->json(['success' => true, 'message' => 'Quote deleted successfully.']);
    }

    public function adminCreate(Request $request): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $data = $request->validate($this->quoteRules());
        try {
            $quote = $this->quotes->createAndSend(null, $request->user(), $data);
            return response()->json([
                'success' => true,
                'message' => $quote->email_sent ? 'Quote sent to customer.' : 'Quote created; email could not be sent. Copy the link and share it with the customer.',
                'data' => [
                    'id' => $quote->id,
                    'quote_number' => $quote->quote_number,
                    'status' => $quote->status,
                    'total_inc_gst' => $quote->total_inc_gst,
                    'currency' => $quote->currency,
                    'expires_at' => $quote->expires_at?->toIso8601String(),
                    'quote_url' => $quote->quote_url,
                    'email_sent' => $quote->email_sent,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Unable to create standalone customer quote: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Unable to create and send this quote. Please check the details and try again.'], 422);
        }
    }

    public function adminResend(Request $request, string $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        try {
            $result = $this->quotes->resend(CustomerQuote::findOrFail($id));
            return response()->json([
                'success' => true,
                'message' => $result['email_sent'] ? 'Quote email sent again.' : 'Email could not be sent. Copy and share this quote link instead.',
                'data' => $result,
            ]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => collect($e->errors())->flatten()->first()], 422);
        }
    }

    public function adminStore(Request $request, string $enquiryId): JsonResponse
    {
        if (!$request->user()?->isAdmin()) return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        $enquiry = CustomerEnquiry::findOrFail($enquiryId);
        $data = $request->validate($this->quoteRules());
        try {
            $quote = $this->quotes->createAndSend($enquiry, $request->user(), $data);
            return response()->json([
                'success' => true,
                'message' => $quote->email_sent ? 'Quote sent to customer.' : 'Quote created; email could not be sent. Copy the link and share it with the customer.',
                'data' => [
                    'id' => $quote->id,
                    'quote_number' => $quote->quote_number,
                    'status' => $quote->status,
                    'total_inc_gst' => $quote->total_inc_gst,
                    'currency' => $quote->currency,
                    'expires_at' => $quote->expires_at?->toIso8601String(),
                    'quote_url' => $quote->quote_url,
                    'email_sent' => $quote->email_sent,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Unable to create customer quote: ' . $e->getMessage(), ['enquiry_id' => $enquiry->id]);
            return response()->json(['success' => false, 'message' => 'Unable to create and send this quote. Please check the details and try again.'], 422);
        }
    }

    private function quoteRules(): array
    {
        return [
            'customer_id' => ['nullable'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'recipient_email' => ['required', 'email', 'max:255'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.product_id' => ['nullable'],
            'items.*.product_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'items.*.unit_price_ex_gst' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'items.*.price' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'items.*.line_total_ex_gst' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'items.*.specifications' => ['nullable', 'string', 'max:2000'],
            'items.*.options' => ['nullable', 'array'],
            'delivery_method' => ['nullable', 'string', 'max:100'],
            'delivery_address' => ['nullable', 'string', 'max:255'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'internal_notes' => ['nullable', 'string', 'max:5000'],
            'customer_notes' => ['nullable', 'string', 'max:5000'],
            'terms' => ['nullable', 'string', 'max:5000'],
            'valid_for_days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ];
    }

    public function show(string $token): JsonResponse
    {
        $quote = $this->quotes->findByToken($token);
        if (!$quote) return response()->json(['success' => false, 'message' => 'This quote link is invalid.'], 404);
        return response()->json(['success' => true, 'data' => $this->quotes->publicData($quote)]);
    }

    public function respond(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', 'in:accept,decline']]);
        try {
            $quote = $this->quotes->respond($token, $data['decision']);
            return response()->json([
                'success' => true,
                'message' => $data['decision'] === 'accept' ? 'Quote accepted. Your order is ready for artwork upload.' : 'Quote declined.',
                'data' => $this->quotes->publicData($quote),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => collect($e->errors())->flatten()->first()], 422);
        }
    }

    public function uploadArtwork(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['required', 'file', 'max:25600', 'mimes:pdf,png,jpg,jpeg,webp,ai,eps,psd,tif,tiff'],
        ]);
        try {
            $quote = $this->quotes->uploadArtwork($token, $data['files']);
            return response()->json(['success' => true, 'message' => 'Artwork uploaded to your order.', 'data' => $this->quotes->publicData($quote)]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => collect($e->errors())->flatten()->first()], 422);
        }
    }
}
