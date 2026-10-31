<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Artwork;
use App\Models\CustomerEnquiry;
use App\Models\CustomerQuote;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\Order\ManualOrderService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerQuoteService
{
    public function createAndSend(?CustomerEnquiry $enquiry, User $staff, array $data): CustomerQuote
    {
        $items = [];
        $subtotal = 0.0;
        foreach ($data['items'] as $item) {
            $quantity = max(1, (int) $item['quantity']);
            if (isset($item['unit_price_ex_gst']) && $item['unit_price_ex_gst'] !== null && $item['unit_price_ex_gst'] !== '') {
                $unitPrice = round((float) $item['unit_price_ex_gst'], 4);
                $lineEx = round($quantity * $unitPrice, 2);
            } elseif (isset($item['price']) && $item['price'] !== null && $item['price'] !== '') {
                $lineEx = round((float) $item['price'], 2);
                $unitPrice = $quantity > 0 ? round($lineEx / $quantity, 4) : $lineEx;
            } elseif (isset($item['line_total_ex_gst']) && $item['line_total_ex_gst'] !== null && $item['line_total_ex_gst'] !== '') {
                $lineEx = round((float) $item['line_total_ex_gst'], 2);
                $unitPrice = $quantity > 0 ? round($lineEx / $quantity, 4) : $lineEx;
            } else {
                $unitPrice = 0.0;
                $lineEx = 0.0;
            }
            $product = !empty($item['product_id']) ? Product::find($item['product_id']) : null;
            $options = $item['options'] ?? [];
            if (!empty($item['specifications'])) $options['specifications'] = trim($item['specifications']);
            $items[] = [
                'product_id' => $product?->id,
                'product_name' => trim($item['product_name']),
                'product_sku' => $product?->sku ?: 'MANUAL-PRD',
                'quantity' => $quantity,
                'unit_price_ex_gst' => $unitPrice,
                'line_total_ex_gst' => $lineEx,
                'line_total_inc_gst' => round($lineEx * 1.10, 2),
                'options' => $options,
            ];
            $subtotal += $lineEx;
        }

        $deliveryMethod = $data['delivery_method'] ?? 'Standard delivery (Free)';
        if (isset($data['shipping_fee']) && $data['shipping_fee'] !== null && $data['shipping_fee'] !== '') {
            $shippingFee = round(max(0, (float) $data['shipping_fee']), 2);
        } else {
            $methodLower = strtolower($deliveryMethod);
            if (str_contains($methodLower, 'express')) {
                $shippingFee = 15.00;
            } else {
                $shippingFee = 0.00;
            }
        }

        $gst = round(($subtotal + $shippingFee) * 0.10, 2);
        $token = Str::random(64);

        $recipientName = trim($data['recipient_name'] ?? $data['customer_name'] ?? $enquiry?->name ?? '');
        if (!empty($data['company_name']) && !str_contains($recipientName, $data['company_name'])) {
            $recipientName = $recipientName ? "{$recipientName} ({$data['company_name']})" : $data['company_name'];
        }

        $terms = !empty($data['terms']) ? $data['terms'] : ($data['customer_notes'] ?? null);
        if (!empty($data['customer_phone']) && !str_contains($terms ?? '', $data['customer_phone'])) {
            $terms = ($terms ? $terms . "\n" : '') . 'Phone: ' . $data['customer_phone'];
        }

        $quote = CustomerQuote::create([
            'customer_enquiry_id' => $enquiry?->id,
            'created_by' => $staff->id,
            'recipient_name' => $recipientName ?: null,
            'recipient_email' => strtolower(trim($data['recipient_email'] ?? $data['customer_email'] ?? '')),
            'quote_number' => $this->generateQuoteNumber(),
            'token_hash' => hash('sha256', $token),
            'items' => $items,
            'delivery_method' => $deliveryMethod,
            'delivery_address' => $data['delivery_address'] ?? $enquiry?->delivery_location,
            'terms' => $terms,
            'currency' => 'AUD',
            'subtotal_ex_gst' => round($subtotal, 2),
            'shipping_fee_inc_gst' => $shippingFee,
            'gst_amount' => $gst,
            'total_inc_gst' => round($subtotal + $shippingFee + $gst, 2),
            'status' => 'sent',
            'expires_at' => now()->addDays((int) ($data['valid_for_days'] ?? 14)),
        ]);

        $url = rtrim(ManualOrderService::getLiveFrontendUrl(), '/') . '/quotes/' . $token;
        $emailSent = false;
        try {
            Mail::to($quote->recipient_email)->send(new \App\Mail\CustomerQuoteMail($quote, $enquiry, $url));
            $emailSent = true;
        } catch (\Throwable $e) {
            Log::warning("Could not email quote {$quote->quote_number}: {$e->getMessage()}", ['quote_id' => $quote->id]);
        }

        $enquiry?->update(['status' => CustomerEnquiry::STATUS_QUOTED]);
        $quote->setAttribute('quote_url', $url);
        $quote->setAttribute('email_sent', $emailSent);
        return $quote;
    }

    public function findByToken(string $token): ?CustomerQuote
    {
        return CustomerQuote::where('token_hash', hash('sha256', $token))
            ->with(['enquiry', 'order.artworks'])
            ->first();
    }

    public function resend(CustomerQuote $quote): array
    {
        if ($quote->status !== 'sent') {
            throw ValidationException::withMessages(['quote' => ['Only quotes awaiting a response can be resent.']]);
        }
        if ($quote->expires_at && $quote->expires_at->isPast()) {
            $quote->update(['status' => 'expired']);
            throw ValidationException::withMessages(['quote' => ['This quote has expired. Create a new quote to send an updated offer.']]);
        }

        $token = Str::random(64);
        $quote->update(['token_hash' => hash('sha256', $token)]);
        $quote->loadMissing('enquiry');
        $url = rtrim(ManualOrderService::getLiveFrontendUrl(), '/') . '/quotes/' . $token;
        $emailSent = false;
        try {
            Mail::to($quote->recipient_email ?: $quote->enquiry?->email)
                ->send(new \App\Mail\CustomerQuoteMail($quote, $quote->enquiry, $url));
            $emailSent = true;
        } catch (\Throwable $e) {
            Log::warning("Could not resend quote {$quote->quote_number}: {$e->getMessage()}", ['quote_id' => $quote->id]);
        }
        return ['quote_url' => $url, 'email_sent' => $emailSent];
    }

    public function publicData(CustomerQuote $quote): array
    {
        if ($quote->status === 'sent' && $quote->expires_at && $quote->expires_at->isPast()) {
            $quote->update(['status' => 'expired']);
            $quote->refresh();
        }
        return [
            'quote_number' => $quote->quote_number,
            'status' => $quote->status,
            'customer_name' => $quote->recipient_name ?: $quote->enquiry?->name,
            'product_name' => $quote->enquiry?->product_name,
            'items' => $quote->items,
            'delivery_method' => $quote->delivery_method,
            'delivery_address' => $quote->delivery_address,
            'terms' => $quote->terms,
            'currency' => $quote->currency,
            'subtotal_ex_gst' => $quote->subtotal_ex_gst,
            'shipping_fee_inc_gst' => $quote->shipping_fee_inc_gst,
            'gst_amount' => $quote->gst_amount,
            'total_inc_gst' => $quote->total_inc_gst,
            'expires_at' => $quote->expires_at?->toIso8601String(),
            'accepted_at' => $quote->accepted_at?->toIso8601String(),
            'order' => $quote->order ? [
                'order_number' => $quote->order->order_number,
                'status' => $quote->order->status->value ?? (string) $quote->order->status,
                'artwork_files' => $quote->order->artworks->map(fn (Artwork $artwork) => [
                    'id' => $artwork->id,
                    'file_name' => $artwork->file_name,
                    'uploaded_at' => $artwork->created_at?->toIso8601String(),
                ])->values(),
            ] : null,
        ];
    }

    public function respond(string $token, string $decision): CustomerQuote
    {
        $quoteId = CustomerQuote::where('token_hash', hash('sha256', $token))->value('id');
        if (!$quoteId) throw ValidationException::withMessages(['quote' => ['This quote link is invalid.']]);

        $result = DB::transaction(function () use ($quoteId, $decision) {
            $quote = CustomerQuote::with('enquiry')->lockForUpdate()->findOrFail($quoteId);
            if ($quote->order_id) {
                if ($decision !== 'accept') {
                    throw ValidationException::withMessages(['quote' => ['This quote has already been accepted.']]);
                }
                return ['quote' => $quote->load('order'), 'created' => false, 'expired' => false];
            }
            if ($quote->status !== 'sent') {
                throw ValidationException::withMessages(['quote' => ['This quote is no longer awaiting a response.']]);
            }
            if ($quote->expires_at && $quote->expires_at->isPast()) {
                $quote->update(['status' => 'expired']);
                return ['quote' => $quote, 'created' => false, 'expired' => true];
            }
            if ($decision === 'decline') {
                $quote->update(['status' => 'declined', 'declined_at' => now()]);
                return ['quote' => $quote, 'created' => false, 'expired' => false];
            }

            $order = $this->createOrderFromQuote($quote);
            $quote->update(['status' => 'converted', 'accepted_at' => now(), 'order_id' => $order->id]);
            $quote->enquiry?->update(['status' => CustomerEnquiry::STATUS_CONVERTED]);
            return ['quote' => $quote->fresh(['enquiry', 'order']), 'created' => true, 'expired' => false];
        });

        if ($result['expired']) {
            throw ValidationException::withMessages(['quote' => ['This quote has expired. Please contact us for an updated quote.']]);
        }
        $quote = $result['quote'];

        if ($decision === 'accept' && $result['created'] && $quote->order) {
            $uploadUrl = rtrim(ManualOrderService::getLiveFrontendUrl(), '/') . '/quotes/' . $token;
            try {
                Mail::to($quote->recipient_email)->send(new \App\Mail\CustomerQuoteAcceptedMail($quote, $quote->enquiry, $quote->order, $uploadUrl));
            } catch (\Throwable $e) {
                Log::warning("Could not email artwork upload link for quote {$quote->quote_number}: {$e->getMessage()}", ['quote_id' => $quote->id]);
            }
        }
        return $quote;
    }

    protected function createOrderFromQuote(CustomerQuote $quote): Order
    {
        $enquiry = $quote->enquiry;
        $customerEmail = strtolower($quote->recipient_email ?: ($enquiry?->email ?? ''));
        $customerName = $quote->recipient_name ?: $enquiry?->name;
        $customer = User::where('email', $customerEmail)->first();
        if (!$customer) {
            $customer = User::create([
                'name' => $customerName ?: 'Customer',
                'email' => $customerEmail,
                'phone' => $enquiry->phone,
                'role' => User::ROLE_CUSTOMER,
                'password' => bcrypt(Str::random(32)),
                'is_active' => true,
            ]);
        }

        do {
            $orderNumber = 'MO-' . str_pad((string) random_int(1000, 99999), 6, '0', STR_PAD_LEFT);
        } while (Order::where('order_number', $orderNumber)->exists());

        $address = array_filter([
            'name' => $customerName,
            'email' => $customerEmail,
            'phone' => $enquiry?->phone,
            'address_line_1' => $quote->delivery_address ?: $enquiry?->delivery_location,
        ], fn ($value) => $value !== null && $value !== '');

        $order = Order::create([
            'order_number' => $orderNumber,
            'user_id' => $customer->id,
            'status' => OrderStatus::ARTWORK_REQUIRED,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => $quote->subtotal_ex_gst,
            'gst_amount' => $quote->gst_amount,
            'shipping_fee_inc_gst' => $quote->shipping_fee_inc_gst,
            'discount_amount' => 0,
            'total_inc_gst' => $quote->total_inc_gst,
            'currency' => $quote->currency,
            'delivery_method' => $quote->delivery_method,
            'shipping_address' => $address,
            'billing_address' => $address,
            'customer_notes' => $quote->terms,
            'admin_notes' => 'Created automatically from accepted quote ' . $quote->quote_number,
            'current_proof_version' => 1,
        ]);

        foreach ($quote->items ?? [] as $item) {
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $lineEx = (float) ($item['line_total_ex_gst'] ?? 0);
            $unit = (float) ($item['unit_price_ex_gst'] ?? ($lineEx / $quantity));
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $item['product_id'] ?? null,
                'product_name' => $item['product_name'],
                'product_sku' => $item['product_sku'] ?? 'MANUAL-PRD',
                'quantity' => $quantity,
                'unit_price_ex_gst' => $unit,
                'unit_price_inc_gst' => round($unit * 1.10, 4),
                'total_price_inc_gst' => $item['line_total_inc_gst'] ?? round($lineEx * 1.10, 2),
                'options_snapshot' => $item['options'] ?? [],
                'production_status' => 'queued',
            ]);
        }

        OrderActivity::record($order->id, 'quote_accepted', 'Order created from customer-accepted quote ' . $quote->quote_number, 'customer', null, [
            'quote_id' => $quote->id,
            'quote_number' => $quote->quote_number,
        ]);
        return $order->fresh(['items', 'user', 'activities']);
    }

    public function uploadArtwork(string $token, array $files): CustomerQuote
    {
        $quote = $this->findByToken($token);
        if (!$quote || !$quote->order || $quote->status !== 'converted') {
            throw ValidationException::withMessages(['quote' => ['Accept the quote before uploading artwork.']]);
        }
        foreach ($files as $file) {
            if (!$file instanceof UploadedFile) continue;
            $path = $file->store('orders/' . $quote->order->order_number . '/customer-artwork', 'public');
            if (!$path) throw ValidationException::withMessages(['files' => ['A file could not be saved. Please try again.']]);
            $url = app()->environment('local') ? Storage::disk('public')->url($path) : ManualOrderService::formatLivePublicStorageUrl($path);
            $quote->order->artworks()->create([
                'user_id' => $quote->order->user_id,
                'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'source_type' => 'upload',
                'status' => \App\Enums\ArtworkStatus::UPLOADED,
                'file_name' => $file->getClientOriginalName(),
                'file_size_bytes' => $file->getSize(),
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'storage_disk' => 'public',
                'storage_path' => $path,
                'public_url' => $url,
                'customer_notes' => 'Uploaded by customer through accepted quote ' . $quote->quote_number,
            ]);
        }
        return $quote->fresh(['enquiry', 'order.artworks']);
    }

    protected function generateQuoteNumber(): string
    {
        do {
            $number = 'QT-' . date('Y') . '-' . strtoupper(Str::random(6));
        } while (CustomerQuote::where('quote_number', $number)->exists());
        return $number;
    }
}
