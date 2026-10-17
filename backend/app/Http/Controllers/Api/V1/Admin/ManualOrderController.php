<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\OrderActivity;
use App\Models\Order;
use App\Services\Order\ManualOrderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ManualOrderController extends Controller
{
    public function __construct(
        protected ManualOrderService $manualOrderService
    ) {}

    /**
     * List and filter manual orders.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $search = trim((string) $request->query('search', ''));
        $customerId = $request->query('customer_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $pendingApproval = $request->boolean('pending_approval');
        $pendingPayment = $request->boolean('pending_payment');

        $query = Order::query()
            ->with([
                'user:id,name,email,company_name,phone',
                'items.product:id,name,slug',
               'activeReviewLink',
                'payments:id,order_id,amount,status,transaction_id,created_at',
            ])
            ->latest('created_at');

        // Status filter
        if (!empty($status) && $status !== 'all') {
            $query->where('status', $status);
        }

        // Quick filter: Pending customer approval
        if ($pendingApproval) {
            $query->where('status', OrderStatus::ARTWORK_REVIEW);
        }

        // Quick filter: Pending payment
        if ($pendingPayment) {
            $query->where('payment_status', '!=', PaymentStatus::PAID)
                  ->where('status', '!=', OrderStatus::DRAFT);
        }

        // Customer filter
        if (!empty($customerId)) {
            $query->where('user_id', $customerId);
        }

        // Date range filter
        if (!empty($dateFrom)) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if (!empty($dateTo)) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        // Search by order number, customer name, email, or item product
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%")
                         ->orWhere('company_name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('items', function ($iq) use ($search) {
                      $iq->where('product_name', 'like', "%{$search}%");
                  });
            });
        }

        $orders = $query->paginate($request->integer('per_page', 20));

        // Format orders for staff table
        $orders->getCollection()->transform(function ($order) {
            $activeLink = $order->activeReviewLink;
            $firstItem = $order->items->first();
            $itemsCount = $order->items->count();

            $productSummary = $firstItem
                ? ($firstItem->product_name . ($itemsCount > 1 ? " (+".($itemsCount-1)." more)" : ""))
                : 'Custom Print';

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => [
                    'id' => $order->user?->id,
                    'name' => $order->user?->name ?? 'Guest Customer',
                    'email' => $order->shipping_address['email'] ?? $order->user?->email,
                    'company_name' => $order->user?->company_name ?? ($order->shipping_address['company'] ?? null),
                ],
                'product_summary' => $productSummary,
                'status' => $order->status->value ?? (string) $order->status,
                'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                'total' => (float) $order->total_inc_gst,
                'total_formatted' => '$' . number_format((float) $order->total_inc_gst, 2),
                'date' => $order->created_at->format('d M Y'),
                'created_at' => $order->created_at->toIso8601String(),
                'proof_version' => 'V' . ($order->current_proof_version ?? 1),
                'review_link' => $activeLink ? [
                    'status' => $activeLink->status,
                    'open_count' => $activeLink->open_count,
                    'last_opened_at' => $activeLink->last_opened_at?->diffForHumans(),
                    'expires_at' => $activeLink->expires_at?->toIso8601String(),
                ] : null,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    /**
     * Get single manual order details with full activity history and proofing state.
     */
    public function show(string $id): JsonResponse
    {
        $order = Order::with([
            'user',
            'items.product',
            'artworks.versions' => function ($q) {
                $q->orderByDesc('version_number');
            },
            'activeReviewLink',
            'activities' => function ($q) {
                $q->orderByDesc('created_at');
            },
            'payments',
            'invoice',
        ])
        ->where('id', $id)
        ->orWhere('order_number', $id)
        ->firstOrFail();

        $activeLink = $order->activeReviewLink;
        $baseUrl = ManualOrderService::getLiveFrontendUrl();
        $reviewUrl = $activeLink ? "{$baseUrl}/orders/review/{$activeLink->token}" : null;

        // Primary artwork & version history
        $artwork = $order->artworks->first();
        $versions = $artwork ? $artwork->versions : collect();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status->value ?? (string) $order->status,
                'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                'customer' => [
                    'id' => $order->user?->id,
                    'name' => $order->user?->name,
                    'email' => $order->shipping_address['email'] ?? $order->user?->email,
                    'phone' => $order->shipping_address['phone'] ?? $order->user?->phone,
                    'company_name' => $order->user?->company_name ?? ($order->shipping_address['company'] ?? null),
                ],
                'delivery_method' => $order->delivery_method ?? 'Standard delivery (Free)',
                'delivery_address' => $order->shipping_address['address_line_1'] ?? '',
                'shipping_address' => $order->shipping_address,
                'billing_address' => $order->billing_address,
                'customer_notes' => $order->customer_notes,
                'internal_notes' => $order->admin_notes,
                'subtotal_ex_gst' => (float) $order->subtotal_ex_gst,
                'gst_amount' => (float) $order->gst_amount,
                'shipping_fee_inc_gst' => (float) $order->shipping_fee_inc_gst,
                'discount_amount' => (float) $order->discount_amount,
                'total_inc_gst' => (float) $order->total_inc_gst,
                'currency' => $order->currency ?? 'AUD',
                'current_proof_version' => $order->current_proof_version ?? 1,
                'approved_proof_version' => $order->approved_proof_version,
                'proof_approved_at' => $order->proof_approved_at?->toIso8601String(),
                'proof_approved_by' => $order->proof_approved_by,
                'reminder_sent_at' => $order->reminder_sent_at?->toIso8601String(),
                'items' => $order->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'quantity' => $item->quantity,
                        'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                        'total_price_inc_gst' => (float) $item->total_price_inc_gst,
                        'specifications' => $item->options_snapshot['specifications'] ?? 'Standard Specifications',
                        'options' => $item->options_snapshot,
                        'production_status' => $item->production_status,
                    ];
                }),
                'proof' => [
                    'current_version' => $order->current_proof_version ?? 1,
                    'status' => $artwork->proof_status ?? 'ready',
                    'files' => $versions->first()?->proof_files ?? [],
                    'versions' => $versions->map(function ($ver) {
                        return [
                            'id' => $ver->id,
                            'version_number' => $ver->version_number,
                            'label' => 'Proof V' . $ver->version_number,
                            'files' => $ver->proof_files ?? [],
                            'pdf_url' => $ver->proof_pdf_url,
                            'thumbnail_url' => $ver->thumbnail_url,
                            'is_approved' => (bool) $ver->is_approved,
                            'uploaded_at' => $ver->created_at->toIso8601String(),
                            'uploaded_at_formatted' => $ver->created_at->format('d M Y, h:i A'),
                            'change_summary' => $ver->change_summary,
                        ];
                    }),
                ],
                'review_link' => $activeLink ? [
                    'id' => $activeLink->id,
                    'token' => $activeLink->token,
                    'url' => $reviewUrl,
                    'status' => $activeLink->status,
                    'open_count' => $activeLink->open_count,
                    'last_opened_at' => $activeLink->last_opened_at?->diffForHumans(),
                    'last_opened_at_exact' => $activeLink->last_opened_at?->toIso8601String(),
                    'expires_at' => $activeLink->expires_at?->toIso8601String(),
                    'is_valid' => $activeLink->isValid(),
                ] : null,
                'activities' => $order->activities->map(function ($act) {
                    return [
                        'id' => $act->id,
                        'event_type' => $act->event_type,
                        'description' => $act->description,
                        'actor_type' => $act->actor_type,
                        'actor_name' => $act->actor_name,
                        'metadata' => $act->metadata,
                        'created_at' => $act->created_at->toIso8601String(),
                        'time_ago' => $act->created_at->diffForHumans(),
                    ];
                }),
                'created_at' => $order->created_at->toIso8601String(),
                'updated_at' => $order->updated_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Live calculation endpoint: authoritatively calculate totals for given items & delivery.
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'string'],
            'items.*.product_name' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price_ex_gst' => ['nullable', 'numeric', 'min:0'],
            'items.*.price' => ['nullable', 'numeric', 'min:0'],
            'items.*.line_total_ex_gst' => ['nullable', 'numeric', 'min:0'],
            'items.*.options' => ['nullable', 'array'],
            'delivery_method' => ['nullable', 'string', 'max:100'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
        ]);

        $calculated = $this->manualOrderService->calculateTotals(
            $validated['items'],
            $validated['delivery_method'] ?? 'Standard delivery (Free)',
            $validated['shipping_fee'] ?? null
        );

        return response()->json([
            'success' => true,
            'data' => $calculated,
        ]);
    }

    /**
     * Store new manual order as draft.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_email' => ['required', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'company_name' => ['nullable', 'string', 'max:150'],
            'delivery_method' => ['nullable', 'string', 'max:100'],
            'delivery_address' => ['required', 'string', 'max:255'],
            'customer_notes' => ['nullable', 'string', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'string'],
            'items.*.product_name' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price_ex_gst' => ['nullable', 'numeric', 'min:0'],
            'items.*.price' => ['nullable', 'numeric', 'min:0'],
            'items.*.line_total_ex_gst' => ['nullable', 'numeric', 'min:0'],
            'items.*.specifications' => ['nullable', 'string'],
            'items.*.options' => ['nullable', 'array'],
        ]);

        try {
            $order = $this->manualOrderService->createManualOrder(
                $request->user(),
                $validated
            );

            return response()->json([
                'success' => true,
                'message' => 'Manual order created successfully as draft.',
                'data' => $order,
            ], 201);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to create manual order.',
            ], 422);
        }
    }

    /**
     * Update manual order draft.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        $validated = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'delivery_method' => ['nullable', 'string', 'max:100'],
            'delivery_address' => ['nullable', 'string', 'max:255'],
            'customer_notes' => ['nullable', 'string', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['nullable', 'string'],
            'items.*.product_name' => ['nullable', 'string'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_price_ex_gst' => ['nullable', 'numeric', 'min:0'],
            'items.*.specifications' => ['nullable', 'string'],
            'items.*.options' => ['nullable', 'array'],
        ]);

        try {
            $updated = $this->manualOrderService->updateManualOrder(
                $order,
                $request->user(),
                $validated
            );

            return response()->json([
                'success' => true,
                'message' => 'Manual order updated successfully.',
                'data' => $updated,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to update manual order.',
            ], 422);
        }
    }

    /**
     * Upload proof files for an order.
     */
    public function uploadProof(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['file', 'mimes:jpg,jpeg,png,svg,pdf', 'max:51200'], // max 50MB per file
            'version' => ['nullable', 'integer', 'min:1'],
            'order_item_id' => ['nullable', 'string'],
        ]);

        try {
            $version = $this->manualOrderService->uploadProofFiles(
                $order,
                $request->user(),
                $request->file('files'),
                $request->input('version'),
                $request->input('order_item_id')
            );

            return response()->json([
                'success' => true,
                'message' => 'Proof files uploaded successfully.',
                'data' => $version,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to upload proof files.',
            ], 422);
        }
    }

    /** Attach the artwork created in Designer to a manual order line. */
    public function attachArtwork(Request $request, string $id, string $itemId): JsonResponse
    {
        $validated = $request->validate([
            'artwork_id' => ['required', 'uuid', 'exists:artworks,id'],
        ]);

        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();
        $item = $order->items()->where('id', $itemId)->firstOrFail();
        $artwork = Artwork::findOrFail($validated['artwork_id']);

        if ($item->product_id && $artwork->product_id !== $item->product_id) {
            return response()->json([
                'success' => false,
                'message' => 'Artwork product does not match this order item.',
            ], 422);
        }

        DB::transaction(function () use ($order, $item, $artwork, $request) {
            $artwork->order_id = $order->id;
            $artwork->save();

            $item->artwork_id = $artwork->id;
            $item->designer_canvas_state = $artwork->canvas_json;
            $item->save();

            OrderActivity::record(
                $order->id,
                'artwork_linked',
                'Designer artwork linked to order item.',
                'admin',
                $request->user(),
                ['order_item_id' => $item->id, 'artwork_id' => $artwork->id]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Artwork linked to order successfully.',
            'data' => ['order_id' => $order->id, 'order_item_id' => $item->id, 'artwork_id' => $artwork->id],
        ]);
    }

    /**
     * Send order to customer for review and approval.
     */
    public function sendForApproval(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        try {
            $result = $this->manualOrderService->sendForApproval($order, $request->user());

            return response()->json([
                'success' => true,
                'message' => 'Order sent for customer approval.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to send for approval.',
            ], 422);
        }
    }

    /**
     * Regenerate customer review link.
     */
    public function regenerateLink(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        try {
            $link = $this->manualOrderService->generateReviewLink($order, $request->user());
            $baseUrl = ManualOrderService::getLiveFrontendUrl();

            return response()->json([
                'success' => true,
                'message' => 'Customer review link regenerated successfully.',
                'data' => [
                    'token' => $link->token,
                    'url' => "{$baseUrl}/orders/review/{$link->token}",
                    'expires_at' => $link->expires_at?->toIso8601String(),
                ],
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to regenerate review link.',
            ], 422);
        }
    }

    /**
     * Revoke customer review link.
     */
    public function revokeLink(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        try {
            $this->manualOrderService->revokeReviewLink($order, $request->user());

            return response()->json([
                'success' => true,
                'message' => 'Customer review link revoked successfully.',
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to revoke review link.',
            ], 422);
        }
    }

    /**
     * Send review or payment reminder to customer.
     */
    public function sendReminder(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        try {
            $result = $this->manualOrderService->sendReminder($order, $request->user());

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to send reminder.',
            ], 422);
        }
    }

    /**
     * Advance order to production when approved and paid.
     */
    public function moveToProduction(Request $request, string $id): JsonResponse
    {
        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();

        try {
            $updated = $this->manualOrderService->moveToProduction($order, $request->user());

            return response()->json([
                'success' => true,
                'message' => 'Order moved to production queue.',
                'data' => $updated,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Cannot move order to production.',
            ], 422);
        }
    }
}
