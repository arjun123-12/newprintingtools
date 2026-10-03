<?php

namespace App\Services\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PaymentGatewayService
{
    /**
     * Build an HTTP client instance with environment-aware SSL verification options.
     */
    protected function newHttpClient(string $basicAuthUser, string $password): PendingRequest
    {
        $client = Http::timeout(45)
            ->withBasicAuth($basicAuthUser, $password)
            ->withHeaders([
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ]);

        $disableSsl = (bool) (config('services.bpoint.disable_ssl_verify') ?? env('BPOINT_DISABLE_SSL_VERIFY', false));
        if ($disableSsl || ! app()->isProduction()) {
            $client = $client->withoutVerifying();
        }

        return $client;
    }

    /**
     * Determine whether the BPOINT payment gateway is configured and enabled.
     */
    public function isEnabled(): bool
    {
        $enabled = (bool) (config('services.bpoint.enabled') ?? config('services.payment_gateway.enabled') ?? false);
        $merchantNumber = config('services.bpoint.merchant_number') ?: config('services.payment_gateway.merchant_id');
        $apiUsername = config('services.bpoint.api_username') ?: config('services.payment_gateway.api_username');
        $apiPassword = config('services.bpoint.api_password') ?: config('services.payment_gateway.api_password');

        return $enabled && !empty($merchantNumber) && !empty($apiUsername) && !empty($apiPassword);
    }

    /**
     * Create a BPOINT v5 AuthKey and attach order transaction details.
     *
     * @param Order $order
     * @param string|null $customerEmail
     * @return array
     */
    public function createSession(Order $order, ?string $customerEmail = null): array
    {
        if (! $this->isEnabled()) {
            return [
                'enabled' => false,
                'message' => 'BPOINT UAT payment gateway is currently not configured or disabled.',
                'order_number' => $order->order_number,
                'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
            ];
        }

        $baseUrl = rtrim(config('services.bpoint.base_url') ?: 'https://bpoint.uat.linkly.com.au/rest/v5', '/');
        $merchantNumber = config('services.bpoint.merchant_number') ?: config('services.payment_gateway.merchant_id');
        $apiUsername = config('services.bpoint.api_username') ?: config('services.payment_gateway.api_username');
        $apiPassword = config('services.bpoint.api_password') ?: config('services.payment_gateway.api_password');

        // BPOINT Basic Auth format: apiUsername|merchantNumber
        $basicAuthUser = str_contains($apiUsername, '|') ? $apiUsername : "{$apiUsername}|{$merchantNumber}";

        // Step 1: Create AuthKey via POST /txns/authkeys
        $createAuthKeyUrl = "{$baseUrl}/txns/authkeys";

        Log::info("Initiating BPOINT v5 AuthKey creation for order: {$order->order_number}");

        try {
            $response = $this->newHttpClient($basicAuthUser, $apiPassword)->post($createAuthKeyUrl);
        } catch (\Throwable $e) {
            Log::error("BPOINT AuthKey request connection error for order {$order->order_number}: " . $e->getMessage());
            throw new RuntimeException('Unable to establish connection to BPOINT payment gateway.');
        }

        if (! $response->successful()) {
            Log::error("BPOINT create authkey rejected for order {$order->order_number}: HTTP {$response->status()}", [
                'status' => $response->status(),
                'error' => $response->json()['message'] ?? $response->body(),
            ]);
            throw new RuntimeException('BPOINT rejected the payment session request.');
        }

        $authKey = $response->json()['authkey'] ?? null;
        if (! $authKey) {
            throw new RuntimeException('BPOINT did not return a valid payment AuthKey.');
        }

        // Step 2: Attach Txn Details via PUT /txns/authkeys/{authkey}/txn-details
        $attachTxnUrl = "{$baseUrl}/txns/authkeys/{$authKey}/txn-details";

        $amountInCents = (int) round(((float) ($order->total_inc_gst ?? $order->total)) * 100);
        $email = $customerEmail ?? $order->shipping_address['email'] ?? $order->user?->email ?? 'customer@example.com';

        $attachPayload = [
            'action' => 'Payment',
            'type' => 'Internet',
            'subType' => 'Single',
            'amount' => $amountInCents,
            'currency' => 'AUD',
            'merchantReference' => (string) $order->order_number,
            'crn1' => (string) $order->order_number,
            'emailAddress' => $email,
            'testMode' => true,
        ];

        try {
            $attachResponse = $this->newHttpClient($basicAuthUser, $apiPassword)->put($attachTxnUrl, $attachPayload);
        } catch (\Throwable $e) {
            Log::error("BPOINT attach txn details connection error for order {$order->order_number}: " . $e->getMessage());
            throw new RuntimeException('Unable to configure order details on BPOINT gateway.');
        }

        if (! $attachResponse->successful()) {
            Log::error("BPOINT attach txn details rejected for order {$order->order_number}: HTTP {$attachResponse->status()}", [
                'status' => $attachResponse->status(),
                'error' => $attachResponse->json()['message'] ?? $attachResponse->body(),
            ]);
            throw new RuntimeException('Failed to bind transaction details with BPOINT gateway.');
        }

        Log::info("BPOINT session prepared successfully for order {$order->order_number} (AUD {$order->total_inc_gst})");

        return [
            'enabled' => true,
            'authkey' => $authKey,
            'order_number' => $order->order_number,
            'amount' => (float) ($order->total_inc_gst ?? $order->total),
            'amount_cents' => $amountInCents,
            'currency' => 'AUD',
            'client_script_url' => config('services.bpoint.client_script_url', 'https://bpoint.uat.linkly.com.au/rest/clientscripts/api.js'),
            'environment' => 'uat',
        ];
    }

    /**
     * Process and verify payment for the order using BPOINT v5 API.
     *
     * @param Order $order
     * @param string $authKey
     * @param User|null $user
     * @return array
     */
    public function processPayment(Order $order, string $authKey, ?User $user = null): array
    {
        // 1. Idempotency check: If order is already paid, do not re-process
        if ($order->payment_status === PaymentStatus::PAID) {
            return [
                'success' => true,
                'paid' => true,
                'order_number' => $order->order_number,
                'message' => 'Order is already paid.',
            ];
        }

        if (! $this->isEnabled()) {
            return [
                'success' => false,
                'paid' => false,
                'order_number' => $order->order_number,
                'message' => 'BPOINT gateway is currently disabled.',
            ];
        }

        $baseUrl = rtrim(config('services.bpoint.base_url') ?: 'https://bpoint.uat.linkly.com.au/rest/v5', '/');
        $merchantNumber = config('services.bpoint.merchant_number') ?: config('services.payment_gateway.merchant_id');
        $apiUsername = config('services.bpoint.api_username') ?: config('services.payment_gateway.api_username');
        $apiPassword = config('services.bpoint.api_password') ?: config('services.payment_gateway.api_password');

        $basicAuthUser = str_contains($apiUsername, '|') ? $apiUsername : "{$apiUsername}|{$merchantNumber}";

        $processUrl = "{$baseUrl}/txns/authkeys/{$authKey}/process";

        Log::info("Submitting BPOINT transaction processing for order: {$order->order_number}");

        try {
            $response = $this->newHttpClient($basicAuthUser, $apiPassword)->post($processUrl, (object)[]);
        } catch (\Throwable $e) {
            Log::error("BPOINT transaction processing connection failure for order {$order->order_number}: " . $e->getMessage());
            return [
                'success' => false,
                'paid' => false,
                'order_number' => $order->order_number,
                'message' => 'Network error connecting to payment processor. Please retry or contact support.',
            ];
        }

        if (! $response->successful()) {
            $errorData = $response->json();
            Log::error("BPOINT process payment rejected for order {$order->order_number}: HTTP {$response->status()}", [
                'status' => $response->status(),
                'error' => $errorData['message'] ?? $response->body(),
            ]);

            return [
                'success' => false,
                'paid' => false,
                'order_number' => $order->order_number,
                'message' => $errorData['message'] ?? 'Payment processor returned an error.',
            ];
        }

        $result = $response->json();
        $txn = $result['txn'] ?? [];
        $responseCode = (string) ($txn['responseCode'] ?? '-1');
        $responseText = $txn['responseText'] ?? 'Unknown';
        $receiptNumber = $txn['receiptNumber'] ?? null;
        $txnNumber = $txn['txnNumber'] ?? null;
        $authoriseId = $txn['authoriseId'] ?? null;

        // Safe logging: Never log card details or passwords
        Log::info("BPOINT verification for order {$order->order_number}: ResponseCode={$responseCode}, Receipt={$receiptNumber}, TxnNumber={$txnNumber}");

        // In BPOINT API: responseCode "0" represents Approved transaction
        if ($responseCode === '0') {
            return DB::transaction(function () use ($order, $txn, $authKey, $user, $receiptNumber, $txnNumber, $authoriseId) {
                // Idempotency check on payments table
                $existingPayment = Payment::where('order_id', $order->id)
                    ->where('status', 'succeeded')
                    ->first();

                if (! $existingPayment) {
                    Payment::create([
                        'order_id' => $order->id,
                        'gateway' => 'bpoint',
                        'transaction_id' => $txnNumber ?? $receiptNumber ?? $authKey,
                        'amount' => (float) ($order->total_inc_gst ?? $order->total),
                        'currency' => $txn['currency'] ?? 'AUD',
                        'status' => 'succeeded',
                        'payload' => [
                            'txn_number' => $txnNumber,
                            'receipt_number' => $receiptNumber,
                            'authorise_id' => $authoriseId,
                            'response_code' => $txn['responseCode'] ?? '0',
                            'response_text' => $txn['responseText'] ?? 'APPROVED',
                            'bank_response_code' => $txn['bankResponseCode'] ?? null,
                            'settlement_date' => $txn['settlementDate'] ?? null,
                            'card_scheme' => $txn['paymentMethod']['card']['scheme'] ?? null,
                            'card_type' => $txn['paymentMethod']['card']['type'] ?? null,
                            'card_masked' => $txn['paymentMethod']['card']['number'] ?? null,
                            'processed_at' => now()->toIso8601String(),
                        ],
                    ]);
                }

                // Update order to paid & processing
                $order->update([
                    'payment_status' => PaymentStatus::PAID,
                    'status' => OrderStatus::PROCESSING,
                ]);

                // Clear customer's shopping cart after confirmed payment
                $userId = $user?->id ?? $order->user_id;
                if ($userId) {
                    $cart = Cart::where('user_id', $userId)->first();
                    if ($cart) {
                        CartItem::where('cart_id', $cart->id)->delete();
                    }
                }

                return [
                    'success' => true,
                    'paid' => true,
                    'order_number' => $order->order_number,
                    'receipt_number' => $receiptNumber,
                    'txn_number' => $txnNumber,
                    'authorise_id' => $authoriseId,
                    'message' => 'Payment approved successfully.',
                ];
            });
        }

        // If responseCode is not "0", payment was declined or failed
        // Record failed transaction attempt safely
        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'bpoint',
            'transaction_id' => $txnNumber ?? $receiptNumber ?? null,
            'amount' => (float) ($order->total_inc_gst ?? $order->total),
            'currency' => $txn['currency'] ?? 'AUD',
            'status' => 'failed',
            'payload' => [
                'response_code' => $responseCode,
                'response_text' => $responseText,
                'bank_response_code' => $txn['bankResponseCode'] ?? null,
                'receipt_number' => $receiptNumber,
                'txn_number' => $txnNumber,
                'attempted_at' => now()->toIso8601String(),
            ],
        ]);

        // Keep order pending / unpaid
        return [
            'success' => false,
            'paid' => false,
            'order_number' => $order->order_number,
            'receipt_number' => $receiptNumber,
            'response_code' => $responseCode,
            'message' => "Payment declined: {$responseText} (Code: {$responseCode})",
        ];
    }
}
