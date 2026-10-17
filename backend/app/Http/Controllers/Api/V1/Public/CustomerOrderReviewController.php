<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\ArtworkReview;
use App\Models\ArtworkVersion;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderReviewLink;
use App\Services\Notification\OrderNotificationService;
use App\Services\Payments\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class CustomerOrderReviewController extends Controller
{
    public function __construct(
        protected OrderNotificationService $notificationService,
        protected PaymentGatewayService $paymentGatewayService
    ) {}

    /**
     * Resolve and validate review link.
     */
    protected function resolveLink(string $token): ?OrderReviewLink
    {
        return OrderReviewLink::where('token', $token)->first();
    }

    /**
     * Track meaningful visit with deduplication (5-minute window per IP).
     */
    protected function recordMeaningfulVisit(OrderReviewLink $link, Request $request): void
    {
        $ip = $request->ip();
        $now = now();

        $shouldCount = false;
        if (!$link->last_opened_at) {
            $shouldCount = true;
        } elseif ($link->last_opened_ip !== $ip) {
            $shouldCount = true;
        } elseif ($link->last_opened_at->diffInMinutes($now) >= 5) {
            $shouldCount = true;
        }

        if ($shouldCount) {
            $link->increment('open_count');
            $link->update([
                'last_opened_at' => $now,
                'last_opened_ip' => $ip,
            ]);

            OrderActivity::record(
                $link->order_id,
                'review_link_opened',
                'Customer opened review portal (Visit #' . $link->open_count . ')',
                'customer',
                null,
                ['ip' => substr($ip, 0, 7) . '***']
            );
        }
    }

    /**
     * Get customer-safe order details for proof review portal.
     * Note: Admin/internal notes and payment secrets are strictly excluded.
     */
    public function show(Request $request, string $token): JsonResponse
    {
        $link = $this->resolveLink($token);

        if (!$link) {
            return response()->json([
                'success' => false,
                'message' => 'This review link is invalid or does not exist.',
            ], 404);
        }

        if ($link->status === 'revoked' || $link->revoked_at !== null) {
            return response()->json([
                'success' => false,
                'message' => 'This review link has been revoked by our prepress team. Please contact us for an updated link.',
            ], 410);
        }

        if ($link->expires_at && $link->expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'message' => 'This review link has expired. Please contact us to generate a fresh link.',
            ], 410);
        }

        // Record meaningful visit
        $this->recordMeaningfulVisit($link, $request);

        $order = Order::with([
            'user:id,name,email,company_name',
            'items.product:id,name,slug',
            'artworks.versions' => function ($q) {
                $q->orderByDesc('version_number');
            },
        ])->findOrFail($link->order_id);

        $artwork = $order->artworks->first();
        $versions = $artwork ? $artwork->versions : collect();
        $currentVersionNum = $order->current_proof_version ?? 1;
        $currentVersion = $versions->firstWhere('version_number', $currentVersionNum) ?: $versions->first();

        // Customer-safe response
        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $order->order_number,
                'status' => $order->status->value ?? (string) $order->status,
                'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                'customer' => [
                    'name' => $order->shipping_address['name'] ?? $order->user?->name,
                    'company_name' => $order->shipping_address['company'] ?? $order->user?->company_name,
                    'email' => $order->shipping_address['email'] ?? $order->user?->email,
                ],
                'delivery_summary' => [
                    'method' => $order->delivery_method ?? 'Standard delivery (Free)',
                    'address' => $order->shipping_address['address_line_1'] ?? '',
                    'city' => $order->shipping_address['city'] ?? '',
                    'state' => $order->shipping_address['state'] ?? '',
                    'postcode' => $order->shipping_address['postcode'] ?? '',
                    'full_address' => ($order->shipping_address['address_line_1'] ?? '') . ', ' . ($order->shipping_address['city'] ?? '') . ' ' . ($order->shipping_address['state'] ?? '') . ' ' . ($order->shipping_address['postcode'] ?? ''),
                ],
                'customer_notes' => $order->customer_notes,
                'items' => $order->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'quantity' => $item->quantity,
                        'specifications' => $item->options_snapshot['specifications'] ?? 'Standard Specifications',
                        'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                        'total_price_inc_gst' => (float) $item->total_price_inc_gst,
                    ];
                }),
                'totals' => [
                    'subtotal_ex_gst' => (float) $order->subtotal_ex_gst,
                    'gst_amount' => (float) $order->gst_amount,
                    'shipping_fee_inc_gst' => (float) $order->shipping_fee_inc_gst,
                    'discount_amount' => (float) $order->discount_amount,
                    'total_inc_gst' => (float) $order->total_inc_gst,
                    'currency' => $order->currency ?? 'AUD',
                ],
                'proof' => [
                    'current_version' => $currentVersionNum,
                    'version_label' => 'Proof V' . $currentVersionNum,
                    'files' => $currentVersion?->proof_files ?? [],
                    'pdf_url' => $currentVersion?->proof_pdf_url,
                    'thumbnail_url' => $currentVersion?->thumbnail_url,
                    'is_approved' => (bool) ($order->approved_proof_version === $currentVersionNum),
                    'approved_at' => $order->proof_approved_at?->toIso8601String(),
                    'versions' => $versions->map(function ($ver) use ($order) {
                        return [
                            'version_number' => $ver->version_number,
                            'label' => 'Proof V' . $ver->version_number,
                            'files' => $ver->proof_files ?? [],
                            'pdf_url' => $ver->proof_pdf_url,
                            'thumbnail_url' => $ver->thumbnail_url,
                            'is_approved' => $order->approved_proof_version === $ver->version_number,
                            'uploaded_at' => $ver->created_at->format('d M Y, h:i A'),
                        ];
                    }),
                ],
            ],
        ]);
    }

    /**
     * Submit customer change request.
     */
    public function requestChanges(Request $request, string $token): JsonResponse
    {
        $link = $this->resolveLink($token);
        if (!$link || !$link->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired review link.',
            ], 403);
        }

        $order = Order::findOrFail($link->order_id);

        if (in_array($order->status, [OrderStatus::IN_PRODUCTION, OrderStatus::DISPATCHED, OrderStatus::DELIVERED])) {
            return response()->json([
                'success' => false,
                'message' => 'This order is already in production and changes can no longer be requested online.',
            ], 422);
        }

        $validated = $request->validate([
            'comment' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        return DB::transaction(function () use ($order, $validated) {
            $order->update([
                'status' => OrderStatus::CHANGES_REQUESTED,
            ]);

            // Record artwork review
            $artwork = $order->artworks()->first();
            if ($artwork) {
                ArtworkReview::create([
                    'artwork_id' => $artwork->id,
                    'version_number' => $order->current_proof_version ?? 1,
                    'reviewer_id' => $order->user_id,
                    'action' => 'changes_requested',
                    'notes' => $validated['comment'],
                ]);
            }

            OrderActivity::record(
                $order->id,
                'change_requested',
                'Customer requested changes: "' . Str::limit($validated['comment'], 120) . '"',
                'customer',
                null,
                ['comment' => $validated['comment']]
            );

            // Alert staff
            $this->notificationService->sendChangeRequestAlert($order, $validated['comment']);

            return response()->json([
                'success' => true,
                'message' => 'Your change request has been submitted to our prepress team.',
                'data' => [
                    'order_number' => $order->order_number,
                    'status' => 'changes_requested',
                ],
            ]);
        });
    }

    /**
     * Approve exact artwork proof version.
     */
    public function approve(Request $request, string $token): JsonResponse
    {
        $link = $this->resolveLink($token);
        if (!$link || !$link->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired review link.',
            ], 403);
        }

        $order = Order::findOrFail($link->order_id);

        $validated = $request->validate([
            'spelling_confirmed' => ['required', 'accepted'],
            'specs_confirmed' => ['required', 'accepted'],
            'proof_version_confirmed' => ['required', 'accepted'],
            'version_number' => ['required', 'integer'],
        ]);

        // Security check: Must approve the current active version, not an outdated one
        $currentVersionNum = (int) ($order->current_proof_version ?? 1);
        if ((int) $validated['version_number'] !== $currentVersionNum) {
            return response()->json([
                'success' => false,
                'message' => "You are approving Proof V{$validated['version_number']}, but a newer revision (Proof V{$currentVersionNum}) is available. Please reload and review the latest proof.",
            ], 422);
        }

        return DB::transaction(function () use ($order, $currentVersionNum) {
            $artwork = $order->artworks()->first();
            if ($artwork) {
                ArtworkVersion::where('artwork_id', $artwork->id)
                    ->where('version_number', $currentVersionNum)
                    ->update(['is_approved' => true]);

                ArtworkReview::create([
                    'artwork_id' => $artwork->id,
                    'version_number' => $currentVersionNum,
                    'reviewer_id' => $order->user_id,
                    'action' => 'approved',
                    'notes' => 'Proof V' . $currentVersionNum . ' approved by customer on portal.',
                ]);
            }

            // Update order status
            $order->update([
                'approved_proof_version' => $currentVersionNum,
                'proof_approved_at' => now(),
                'proof_approved_by' => $order->shipping_address['name'] ?? $order->user?->name ?? 'Customer',
                'status' => $order->payment_status === PaymentStatus::PAID ? OrderStatus::IN_PRODUCTION : OrderStatus::PENDING_PAYMENT,
            ]);

            OrderActivity::record(
                $order->id,
                'proof_approved',
                'Exact Proof V' . $currentVersionNum . ' approved by customer.',
                'customer',
                null,
                ['version' => $currentVersionNum]
            );

            // Notify staff
            $this->notificationService->sendProofApprovalAlert($order, $currentVersionNum);

            return response()->json([
                'success' => true,
                'message' => 'Proof V' . $currentVersionNum . ' approved successfully. Please continue to payment.',
                'data' => [
                    'order_number' => $order->order_number,
                    'approved_version' => $currentVersionNum,
                    'status' => $order->status->value ?? (string) $order->status,
                    'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                    'ready_for_payment' => $order->payment_status !== PaymentStatus::PAID,
                ],
            ]);
        });
    }

    /**
     * Create BPOINT payment session for customer review portal.
     */
    public function createPaymentSession(Request $request, string $token): JsonResponse
    {
        $link = $this->resolveLink($token);
        if (!$link || !$link->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired review link.',
            ], 403);
        }

        $order = Order::findOrFail($link->order_id);

        if ($order->payment_status === PaymentStatus::PAID) {
            return response()->json([
                'success' => false,
                'message' => 'This order is already paid.',
                'data' => ['paid' => true],
            ], 409);
        }

        if (empty($order->approved_proof_version)) {
            return response()->json([
                'success' => false,
                'message' => 'Please review and approve your artwork proof before continuing to payment.',
            ], 422);
        }

        try {
            $customerEmail = $order->shipping_address['email'] ?? $order->user?->email;
            $result = $this->paymentGatewayService->createSession($order, $customerEmail);

            if (!($result['enabled'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'] ?? 'Payment gateway is currently unavailable.',
                    'data' => $result,
                ], 503);
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Unable to initialize secure payment session.',
            ], 502);
        }
    }

    /**
     * Process and verify payment through BPOINT gateway.
     */
    public function processPayment(Request $request, string $token): JsonResponse
    {
        $link = $this->resolveLink($token);
        if (!$link || !$link->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired review link.',
            ], 403);
        }

        $order = Order::findOrFail($link->order_id);

        $validated = $request->validate([
            'authkey' => ['required', 'string', 'min:5'],
        ]);

        if ($order->payment_status === PaymentStatus::PAID) {
            return response()->json([
                'success' => true,
                'message' => 'This order is already marked as paid.',
                'data' => [
                    'paid' => true,
                    'order_number' => $order->order_number,
                    'status' => $order->status->value ?? (string) $order->status,
                ],
            ]);
        }

        try {
            $result = $this->paymentGatewayService->processPayment(
                $order,
                $validated['authkey'],
                $order->user
            );

            if ($result['paid']) {
                // Advance order to in_production if proof was already approved
                if ($order->approved_proof_version) {
                    $order->update([
                        'status' => OrderStatus::IN_PRODUCTION,
                    ]);
                    $order->items()->update(['production_status' => 'printing']);

                    OrderActivity::record(
                        $order->id,
                        'in_production',
                        'Payment verified and proof approved. Order moved into production queue.',
                        'system'
                    );
                }

                OrderActivity::record(
                    $order->id,
                    'payment_verified',
                    'Payment of AUD $' . number_format((float) $order->total_inc_gst, 2) . ' verified via BPOINT (Receipt: ' . ($result['receipt_number'] ?? 'N/A') . ').',
                    'payment_gateway',
                    null,
                    ['receipt' => $result['receipt_number'] ?? null, 'txn' => $result['txn_number'] ?? null]
                );

                // Alert staff
                $this->notificationService->sendPaymentConfirmedAlert(
                    $order,
                    (float) $order->total_inc_gst,
                    $result['receipt_number'] ?? null
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Payment approved successfully. Your order is now in production!',
                    'data' => [
                        'paid' => true,
                        'order_number' => $order->order_number,
                        'receipt_number' => $result['receipt_number'] ?? null,
                        'status' => 'in_production',
                    ],
                ]);
            }

            OrderActivity::record(
                $order->id,
                'payment_failed',
                'Payment attempt declined by BPOINT: ' . ($result['message'] ?? 'Declined'),
                'payment_gateway'
            );

            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'Payment could not be completed.',
                'data' => $result,
            ], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'An unexpected error occurred while verifying your payment.',
            ], 502);
        }
    }
}
