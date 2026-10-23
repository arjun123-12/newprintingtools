<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\ArtworkReview;
use App\Models\ArtworkVersion;
use App\Models\DesignTemplate;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderReviewLink;
use App\Models\SpinWinSetting;
use App\Services\Invoice\InvoiceGeneratorService;
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
        protected PaymentGatewayService $paymentGatewayService,
        protected InvoiceGeneratorService $invoiceGenerator
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
            'items.artwork.versions' => function ($q) {
                $q->orderByDesc('version_number');
            },
            'artworks.versions' => function ($q) {
                $q->orderByDesc('version_number');
            },
        ])->findOrFail($link->order_id);

        $primaryItem = $order->items->first(fn ($item) => $item->artwork_id || $item->artwork)
            ?: $order->items->first(fn ($item) => data_get($item->options_snapshot, 'template_id'))
            ?: $order->items->first();
        $artwork = $primaryItem?->artwork ?: $order->artworks->first();
        $selectedTemplateId = data_get($primaryItem?->options_snapshot, 'template_id')
            ?: $artwork?->template_id
            ?: $artwork?->design_template_id;
        $selectedTemplate = $selectedTemplateId
            ? DesignTemplate::query()
                ->select([
                    'id', 'name', 'thumbnail_url', 'canvas_json', 'back_canvas_json',
                    'width_mm', 'height_mm', 'bleed_mm', 'safe_area_mm',
                ])
                ->find($selectedTemplateId)
            : null;
        $templateThumbnail = $selectedTemplate?->thumbnail_url
            ?: data_get($primaryItem?->options_snapshot, 'template_thumbnail_url');
        $versions = $artwork ? $artwork->versions : collect();
        $currentVersionNum = $order->current_proof_version ?? 1;
        $currentVersion = $versions->firstWhere('version_number', $currentVersionNum) ?: $versions->first();

        // Format proof files with authoritative live HTTPS URLs
        $proofFiles = collect($currentVersion?->proof_files ?? [])->map(function ($f) {
            if (is_array($f)) {
                $url = $f['url'] ?? '';
                if (!empty($url) && (str_contains($url, 'localhost') || str_contains($url, '127.0.0.1') || str_starts_with($url, '/'))) {
                    $f['url'] = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($f['storage_path'] ?? $url);
                }
            }
            return $f;
        })->all();

        $thumbnailUrl = $currentVersion?->thumbnail_url ?: $artwork?->thumbnail_url;
        if (!empty($thumbnailUrl) && (str_contains($thumbnailUrl, 'localhost') || str_contains($thumbnailUrl, '127.0.0.1') || str_starts_with($thumbnailUrl, '/'))) {
            $thumbnailUrl = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($currentVersion?->storage_path ?? $thumbnailUrl);
        }
        if (empty($thumbnailUrl)) {
            $thumbnailUrl = $templateThumbnail;
        }

        $pdfUrl = $currentVersion?->proof_pdf_url;
        if (!empty($pdfUrl) && (str_contains($pdfUrl, 'localhost') || str_contains($pdfUrl, '127.0.0.1') || str_starts_with($pdfUrl, '/'))) {
            $pdfUrl = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($currentVersion?->storage_path ?? $pdfUrl);
        }

        $hasUploadedProof = !empty($proofFiles) || !empty($currentVersion?->storage_path);

        $publicStorageUrl = function (?string $url, ?string $storagePath = null): ?string {
            if (empty($url)) return null;
            if (str_contains($url, 'localhost') || str_contains($url, '127.0.0.1') || str_starts_with($url, '/')) {
                return \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($storagePath ?: $url);
            }
            return $url;
        };

        $statusHistory = $order->activities()
            ->where(function ($q) {
                $q->whereIn('event_type', [
                    'order_created',
                    'proof_sent',
                    'proof_approved',
                    'changes_requested',
                    'payment_confirmed',
                    'payment_received',
                    'order_status_updated',
                    'production_status_updated',
                    'moved_to_production',
                    'dispatched',
                    'delivered',
                ])
                ->orWhere('event_type', 'like', '%status%');
            })
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($act) {
                $rawStatus = $act->metadata['new_status'] ?? null;
                $statusLabel = $act->metadata['status_label']
                    ?? ($rawStatus ? (OrderStatus::WORKFLOW_SEQUENCE[$rawStatus] ?? ucwords(str_replace('_', ' ', $rawStatus))) : null);

                return [
                    'id' => $act->id,
                    'event_type' => $act->event_type,
                    'description' => $act->description,
                    'status' => $rawStatus,
                    'status_label' => $statusLabel,
                    'shipping_carrier' => $act->metadata['shipping_carrier'] ?? null,
                    'tracking_number' => $act->metadata['tracking_number'] ?? null,
                    'created_at' => $act->created_at->toIso8601String(),
                    'formatted_date' => $act->created_at->format('d M Y, h:i A'),
                    'time_ago' => $act->created_at->diffForHumans(),
                ];
            });

        // Customer-safe response
        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $order->order_number,
                'status' => $order->status->value ?? (string) $order->status,
                'status_label' => OrderStatus::WORKFLOW_SEQUENCE[$order->status->value ?? (string) $order->status]
                    ?? ($order->status instanceof OrderStatus ? $order->status->label() : ucwords(str_replace('_', ' ', (string) $order->status))),
                'shipping_carrier' => $order->shipping_carrier,
                'tracking_number' => $order->tracking_number,
                'carrier_tracking_url' => \App\Services\Order\ManualOrderService::resolveCarrierTrackingUrl($order->shipping_carrier, $order->tracking_number),
                'status_history' => $statusHistory,
                'proof_watermark_opacity' => $order->proof_watermark_opacity ?? (int) SpinWinSetting::get('proof_watermark_opacity', 40),
                'order_cutoff_time' => $order->order_cutoff_time ?? (string) SpinWinSetting::get('order_cutoff_time', '15:00'),
                'order_cutoff_timezone' => $order->order_cutoff_timezone ?? (string) SpinWinSetting::get('order_cutoff_timezone', 'Australia/Adelaide'),
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
                'items' => $order->items->map(function ($item) use ($publicStorageUrl, $order) {
                    $itemArtwork = $item->artwork;
                    // Backward compatibility: If single product order and item artwork is null, use order's first artwork
                    if (!$itemArtwork && $order->items->count() === 1) {
                        $itemArtwork = $order->artworks->first();
                    }

                    $itemVersions = $itemArtwork?->versions ?? collect();
                    $itemCurrentVerNum = $itemArtwork?->current_version ?: ($order->current_proof_version ?: 1);
                    $itemVersion = $itemVersions->firstWhere('version_number', $itemCurrentVerNum)
                        ?: $itemVersions->first();

                    $itemFiles = collect($itemVersion?->proof_files ?? [])->map(function ($file) use ($publicStorageUrl) {
                        if (!is_array($file)) return $file;
                        $file['url'] = $publicStorageUrl($file['url'] ?? null, $file['storage_path'] ?? null);
                        return $file;
                    })->values();

                    // Backward compatibility for single file version where proof_files array was not stored
                    if ($itemFiles->isEmpty() && ($itemVersion?->proof_pdf_url || $itemVersion?->storage_path || $itemVersion?->thumbnail_url)) {
                        $singleUrl = $publicStorageUrl($itemVersion->proof_pdf_url ?: $itemVersion->thumbnail_url, $itemVersion->storage_path);
                        if ($singleUrl) {
                            $itemFiles = collect([[
                                'label' => 'Front',
                                'file_name' => $itemVersion->file_name ?: 'Front Artwork',
                                'url' => $singleUrl,
                                'storage_path' => $itemVersion->storage_path,
                                'mime_type' => $itemVersion->mime_type ?: 'image/jpeg',
                                'file_size_bytes' => $itemVersion->file_size_bytes,
                            ]]);
                        }
                    }

                    // Identify front and back files specifically for this item
                    $frontEntry = $itemFiles->first(fn ($f) => is_array($f) && strtolower($f['label'] ?? '') === 'front')
                        ?: $itemFiles->first();
                    $backEntry = $itemFiles->first(fn ($f) => is_array($f) && strtolower($f['label'] ?? '') === 'back')
                        ?: ($itemFiles->count() > 1 && $itemFiles[0] === $frontEntry ? $itemFiles[1] : null);

                    $frontUrl = $frontEntry['url'] ?? null;
                    $backUrl = $backEntry['url'] ?? null;

                    $itemThumbnail = $frontUrl ?: $publicStorageUrl(
                        $itemVersion?->thumbnail_url ?: $itemArtwork?->thumbnail_url,
                        $itemVersion?->storage_path ?: $itemArtwork?->storage_path
                    ) ?: data_get($item->options_snapshot, 'template_thumbnail_url');

                    return [
                        'id' => $item->id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'quantity' => $item->quantity,
                        'specifications' => $item->options_snapshot['specifications'] ?? 'Standard Specifications',
                        'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                        'total_price_inc_gst' => (float) $item->total_price_inc_gst,
                        'artwork_preview' => [
                            'has_artwork' => $itemFiles->isNotEmpty() || !empty($itemThumbnail),
                            'files' => $itemFiles->all(),
                            'front_url' => $frontUrl,
                            'back_url' => $backUrl,
                            'thumbnail_url' => $itemThumbnail,
                            'canvas_json' => $itemArtwork?->canvas_json ?? $item->designer_canvas_state,
                            'document_settings' => $itemArtwork?->document_settings ?? [],
                            'dimensions' => [
                                'width_px' => $itemVersion?->width_px ?? $itemArtwork?->width_px,
                                'height_px' => $itemVersion?->height_px ?? $itemArtwork?->height_px,
                                'dpi' => $itemVersion?->dpi ?? $itemArtwork?->dpi,
                            ],
                        ],
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
                    'files' => $proofFiles,
                    'pdf_url' => $pdfUrl,
                    'thumbnail_url' => $thumbnailUrl,
                    'template_canvas_json' => $hasUploadedProof
                        ? null
                        : ($artwork?->canvas_json
                            ?? $primaryItem?->designer_canvas_state
                            ?? $selectedTemplate?->canvas_json),
                    'template_back_canvas_json' => $hasUploadedProof
                        ? null
                        : ((is_array($artwork?->canvas_json) && array_is_list($artwork->canvas_json)
                            ? ($artwork->canvas_json[1] ?? null)
                            : null)
                            ?? $selectedTemplate?->back_canvas_json),
                    'document_settings' => $artwork?->document_settings ?? ($selectedTemplate ? [
                        'name' => $selectedTemplate->name,
                        'width' => $selectedTemplate->width_mm ? (float) $selectedTemplate->width_mm : null,
                        'height' => $selectedTemplate->height_mm ? (float) $selectedTemplate->height_mm : null,
                        'unit' => 'mm',
                        'dpi' => 300,
                        'bleed' => (float) ($selectedTemplate->bleed_mm ?? 0),
                        'safeArea' => (float) ($selectedTemplate->safe_area_mm ?? 0),
                    ] : []),
                    'dimensions' => [
                        'width_px' => $currentVersion?->width_px ?? $artwork?->width_px,
                        'height_px' => $currentVersion?->height_px ?? $artwork?->height_px,
                        'dpi' => $currentVersion?->dpi ?? $artwork?->dpi,
                    ],
                    'is_approved' => (bool) ($order->approved_proof_version === $currentVersionNum),
                    'approved_at' => $order->proof_approved_at?->toIso8601String(),
                    'versions' => $versions->map(function ($ver) use ($order) {
                        $thumb = $ver->thumbnail_url;
                        if (!empty($thumb) && (str_contains($thumb, 'localhost') || str_contains($thumb, '127.0.0.1') || str_starts_with($thumb, '/'))) {
                            $thumb = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($ver->storage_path ?? $thumb);
                        }
                        $pUrl = $ver->proof_pdf_url;
                        if (!empty($pUrl) && (str_contains($pUrl, 'localhost') || str_contains($pUrl, '127.0.0.1') || str_starts_with($pUrl, '/'))) {
                            $pUrl = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($ver->storage_path ?? $pUrl);
                        }
                        $pFiles = collect($ver->proof_files ?? [])->map(function ($f) {
                            if (is_array($f)) {
                                $url = $f['url'] ?? '';
                                if (!empty($url) && (str_contains($url, 'localhost') || str_contains($url, '127.0.0.1') || str_starts_with($url, '/'))) {
                                    $f['url'] = \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($f['storage_path'] ?? $url);
                                }
                            }
                            return $f;
                        })->all();

                        return [
                            'version_number' => $ver->version_number,
                            'label' => 'Proof V' . $ver->version_number,
                            'files' => $pFiles,
                            'pdf_url' => $pUrl,
                            'thumbnail_url' => $thumb,
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

            // Record artwork review for all order artworks
            $artworks = $order->artworks()->get();
            foreach ($artworks as $artwork) {
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
            $artworks = $order->artworks()->get();
            foreach ($artworks as $artwork) {
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
            $invoice = $this->createAndEmailPaidInvoice($order);

            return response()->json([
                'success' => true,
                'message' => 'This order is already marked as paid.',
                'data' => [
                    'paid' => true,
                    'order_number' => $order->order_number,
                    'status' => $order->status->value ?? (string) $order->status,
                    'invoice_number' => $invoice?->invoice_number,
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
                $order->refresh();

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

                $invoice = $this->createAndEmailPaidInvoice($order);

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
                        'invoice_number' => $invoice?->invoice_number,
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

    /**
     * Create and email the invoice only after payment is verified.
     * Failures are logged without turning a successful payment into a failed response.
     */
    protected function createAndEmailPaidInvoice(Order $order): ?Invoice
    {
        try {
            $order->refresh();
            if ($order->payment_status !== PaymentStatus::PAID) {
                return null;
            }

            $order->loadMissing(['user', 'items', 'invoice']);
            $invoice = $this->invoiceGenerator->issuePaidInvoice($order);
            $order->setRelation('invoice', $invoice);

            $invoiceCreated = OrderActivity::query()
                ->where('order_id', $order->id)
                ->where('event_type', 'invoice_generated')
                ->exists();

            if (!$invoiceCreated) {
                OrderActivity::record(
                    $order->id,
                    'invoice_generated',
                    'Paid invoice ' . $invoice->invoice_number . ' created and saved.',
                    'system',
                    null,
                    ['invoice_id' => $invoice->id, 'invoice_number' => $invoice->invoice_number]
                );
            }

            $emailAlreadySent = OrderActivity::query()
                ->where('order_id', $order->id)
                ->where('event_type', 'invoice_emailed')
                ->exists();

            if (!$emailAlreadySent && $this->notificationService->sendPaidInvoice($invoice, $order)) {
                OrderActivity::record(
                    $order->id,
                    'invoice_emailed',
                    'Paid invoice ' . $invoice->invoice_number . ' emailed to the customer.',
                    'system',
                    null,
                    ['invoice_id' => $invoice->id, 'invoice_number' => $invoice->invoice_number]
                );
            }

            return $invoice;
        } catch (Throwable $e) {
            Log::error('Failed to create or email paid invoice for order ' . $order->order_number . ': ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Check Spin & Win eligibility for the manual order represented by this review token.
     */
    public function spinEligibility(
        Request $request,
        string $token,
        \App\Services\Rewards\SpinRewardService $spinRewardService
    ): JsonResponse {
        try {
            $data = $spinRewardService->getEligibility(
                orderNumber: $request->query('order_number'),
                user: $request->user(),
                reviewToken: $token
            );

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 403);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'Unable to evaluate Spin & Win eligibility: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Execute a Spin & Win prize selection bound to this review token.
     */
    public function spin(
        Request $request,
        string $token,
        \App\Services\Rewards\SpinRewardService $spinRewardService
    ): JsonResponse {
        $validated = $request->validate([
            'spin_token' => ['required', 'string', 'max:64'],
            'order_number' => ['nullable', 'string', 'max:64'],
        ]);

        try {
            $data = $spinRewardService->executeSpin(
                orderNumber: $validated['order_number'] ?? null,
                spinToken: $validated['spin_token'],
                user: $request->user(),
                clientIp: $request->ip(),
                reviewToken: $token
            );

            return response()->json([
                'success' => true,
                'message' => 'Reward selected successfully.',
                'data' => $data,
            ]);
        } catch (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 403);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Unable to process reward spin.',
            ], 422);
        }
    }
}
