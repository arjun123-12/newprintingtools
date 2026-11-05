<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderActivity;
use App\Services\Order\ManualOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductionStationController extends Controller
{
    private const STATIONS = [
        'printing' => [
            'label' => 'Printing',
            'from' => ['approved', 'in_production', 'production_started'],
            'to' => 'printing',
        ],
        'cutting_and_finishing' => [
            'label' => 'Cutting & Finishing',
            'from' => ['printing', 'cutting_in_progress'],
            'to' => 'cutting_and_finishing',
        ],
        'quality_check_and_packaging' => [
            'label' => 'Quality Check & Packaging',
            'from' => ['cutting_and_finishing', 'cutting_in_progress'],
            'to' => 'quality_check_and_packaging',
        ],
        'ready_for_dispatch' => [
            'label' => 'Ready for Pickup / Dispatch',
            'from' => ['quality_check_and_packaging', 'production_completed'],
            'to' => null,
        ],
        'handed_over_to_courier' => [
            'label' => 'Handed Over to Courier',
            'from' => ['ready_for_shipping', 'dispatched'],
            'to' => 'handed_over_to_courier',
        ],
        'delivered' => [
            'label' => 'Delivered',
            'from' => ['handed_over_to_courier', 'dispatched'],
            'to' => 'delivered',
        ],
        'collected' => [
            'label' => 'Collected',
            'from' => ['ready_for_pickup'],
            'to' => 'collected',
        ],
    ];

    public function index(string $stage): JsonResponse
    {
        $allProducts = $stage === 'all-products';
        $station = $allProducts ? ['label' => 'All Products'] : $this->station($stage);
        $orders = OrderItem::query()->with(['artwork', 'product'])
            ->whereHas('order', function ($query) use ($stage, $allProducts) {
                if ($allProducts) {
                    $query->whereNotIn('status', ['cancelled', 'completed', 'delivered', 'collected']);
                } else {
                    $query->whereIn('status', ['approved', 'in_production', 'production_started', 'printing', 'cutting_and_finishing', 'cutting_in_progress', 'quality_check_and_packaging', 'production_completed', 'ready_for_pickup', 'ready_for_shipping', 'dispatched', 'handed_over_to_courier']);
                }
                if ($stage === 'printing') $query->where('payment_status', 'paid');
                if ($stage === 'handed_over_to_courier') $query->where('delivery_method', 'not like', '%pickup%');
            })
            ->when($allProducts, fn ($query) => $query->whereNotIn('production_status', ['delivered', 'collected', 'cancelled']), fn ($query) => $query->whereIn('production_status', $this->itemFromStatuses($stage)))
            ->latest('created_at')->limit(500)->get()->map(function (OrderItem $item) use ($stage, $allProducts) {
            $order = $item->order;
            return [
                'id' => $order->id,
                'item_id' => $item->id,
                'item_name' => $item->product_name,
                'item_quantity' => $item->quantity,
                'item_status' => $item->production_status,
                'order_number' => $order->order_number,
                'status' => $item->production_status,
                'product_summary' => $item->product_name . ' × ' . $item->quantity,
                'image_url' => $item->artwork?->thumbnail_url ?: $item->product?->featured_image_url,
                'target_status' => $allProducts ? null : $this->targetStatus($stage, $order),
                'target_label' => $allProducts ? null : $this->targetLabel($stage, $order),
                'created_at' => $order->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'stage' => $stage,
                'label' => $station['label'],
                'orders' => $orders,
            ],
        ]);
    }

    public function complete(Request $request, string $stage, string $id, ManualOrderService $manualOrderService): JsonResponse
    {
        $station = $this->station($stage);
        $validated = $request->validate([
            'item_id' => ['required', 'uuid'],
            'shipping_carrier' => ['nullable', 'string', 'max:150'],
            'tracking_number' => ['nullable', 'string', 'max:150'],
        ]);

        try {
            $result = DB::transaction(function () use ($id, $stage, $station, $validated, $request, $manualOrderService) {
                $order = Order::query()->where('id', $id)->orWhere('order_number', $id)->lockForUpdate()->firstOrFail();
                $currentStatus = $order->status->value ?? (string) $order->status;
                $targetStatus = $this->targetStatus($stage, $order);

                $item = $order->items()->whereKey($validated['item_id'])->lockForUpdate()->firstOrFail();
                $previousItemStatus = (string) $item->production_status;
                $previousOrderStatus = $currentStatus;
                $itemFrom = $this->itemFromStatuses($stage);
                $warnings = [];
                if (!in_array((string) $item->production_status, $itemFrom, true)) {
                    $expected = collect($itemFrom)->map(fn ($status) => ucwords(str_replace('_', ' ', $status)))->implode(' or ');
                    $warnings[] = "Stage sequence warning: {$item->product_name} is currently at " . ucwords(str_replace('_', ' ', (string) $item->production_status)) . "; {$station['label']} normally expects {$expected}. The scan was applied anyway.";
                }
                if ($stage === 'printing' && ($order->payment_status->value ?? (string) $order->payment_status) !== 'paid') {
                    $warnings[] = 'Payment warning: this order is not marked paid. The scan was applied anyway.';
                }
                if ($stage === 'handed_over_to_courier' && str_contains(strtolower((string) $order->delivery_method), 'pickup')) {
                    $warnings[] = 'Delivery warning: this order is marked for store pickup. The Courier Handoff scan was applied anyway.';
                }
                $isEligible = $targetStatus && in_array($currentStatus, $station['from'], true);
                if (!$isEligible) {
                    $currentLabel = OrderStatus::tryFrom($currentStatus)?->label() ?? ucwords(str_replace('_', ' ', $currentStatus));
                    $requiredLabels = collect($station['from'])->map(fn (string $status) => OrderStatus::tryFrom($status)?->label() ?? ucwords(str_replace('_', ' ', $status)))->unique()->implode(' or ');
                    $warnings[] = "Stage sequence warning: order {$order->order_number} is currently at {$currentLabel}; {$station['label']} normally expects {$requiredLabels}. The scan was applied anyway.";
                }
                $itemTarget = $this->itemTargetStatus($stage, $order);
                $item->production_status = $itemTarget;
                $item->save();
                $otherItemsRemain = $order->items()->where('id', '!=', $item->id)->where('production_status', '!=', $itemTarget)->exists();
                if ($otherItemsRemain) {
                    return ['order' => $order, 'item' => $item, 'order_updated' => false, 'status_label' => ucwords(str_replace('_', ' ', $itemTarget)), 'warnings' => $warnings, 'previous_item_status' => $previousItemStatus, 'previous_order_status' => $previousOrderStatus];
                }

                $updatedOrder = $manualOrderService->updateProductionStatus(
                    $order,
                    $targetStatus,
                    $request->user(),
                    $validated['shipping_carrier'] ?? null,
                    $validated['tracking_number'] ?? null
                );
                return ['order' => $updatedOrder, 'item' => $item, 'order_updated' => true, 'status_label' => $this->targetLabel($stage, $updatedOrder), 'warnings' => $warnings, 'previous_item_status' => $previousItemStatus, 'previous_order_status' => $previousOrderStatus];
            });

            $order = $result['order'];

            return response()->json([
                'success' => true,
                'message' => $result['item']->product_name . ' moved to ' . $result['status_label'] . ($result['order_updated'] ? '; all order items are now at this stage.' : '; the order status will advance after the remaining items reach this stage.'),
                'data' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'item_id' => $result['item']->id,
                    'item_name' => $result['item']->product_name,
                    'status' => $result['item']->production_status,
                    'status_label' => $result['status_label'],
                    'previous_item_status' => $result['previous_item_status'],
                    'order_status' => $order->status->value ?? (string) $order->status,
                    'previous_order_status' => $result['previous_order_status'],
                    'order_status_updated' => $result['order_updated'],
                    'warning' => implode(' ', $result['warnings']),
                ],
            ]);
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Order is not eligible for this station.',
                'errors' => $exception->errors(),
            ], 422);
        }
    }

    public function updateItemStatus(Request $request, string $itemId, ManualOrderService $manualOrderService): JsonResponse
    {
        $allowedItemStatuses = [
            'queued', 'prepress', 'approved', 'printing', 'in_production', 'production_started',
            'cutting_and_finishing', 'cutting_in_progress', 'quality_check_and_packaging',
            'production_completed', 'ready_for_pickup', 'ready_for_shipping', 'dispatched',
            'handed_over_to_courier', 'delivered', 'collected', 'cancelled',
        ];
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', $allowedItemStatuses)],
            'shipping_carrier' => ['nullable', 'string', 'max:150'],
            'tracking_number' => ['nullable', 'string', 'max:150'],
        ]);

        try {
            $result = DB::transaction(function () use ($itemId, $validated, $request, $manualOrderService) {
                $item = OrderItem::query()->whereKey($itemId)->firstOrFail();
                $order = Order::query()->whereKey($item->order_id)->lockForUpdate()->firstOrFail();
                $item = $order->items()->whereKey($itemId)->lockForUpdate()->firstOrFail();
                $previousItemStatus = (string) $item->production_status;
                $previousOrderStatus = $order->status->value ?? (string) $order->status;
                $newItemStatus = $validated['status'];

                if ($previousItemStatus === $newItemStatus) {
                    return ['order' => $order, 'item' => $item, 'previous_item_status' => $previousItemStatus, 'previous_order_status' => $previousOrderStatus, 'order_updated' => false, 'warning' => null, 'unchanged' => true];
                }

                $item->production_status = $newItemStatus;
                $item->save();

                $orderStatus = $this->orderStatusForItemStatus($newItemStatus);
                $allItemsAtThisStatus = !$order->items()->where('production_status', '!=', $newItemStatus)->exists();
                $orderUpdated = false;

                if ($orderStatus && $allItemsAtThisStatus) {
                    $manualOrderService->updateProductionStatus(
                        $order,
                        $orderStatus,
                        $request->user(),
                        $validated['shipping_carrier'] ?? null,
                        $validated['tracking_number'] ?? null
                    );
                    $orderUpdated = $previousOrderStatus !== $orderStatus;
                }

                OrderActivity::record(
                    $order->id,
                    'production_item_status_updated',
                    "{$item->product_name} status changed from " . ucwords(str_replace('_', ' ', $previousItemStatus)) . ' to ' . ucwords(str_replace('_', ' ', $newItemStatus)) . ' by ' . $request->user()->name . '.',
                    'staff',
                    $request->user(),
                    [
                        'item_id' => $item->id,
                        'product_name' => $item->product_name,
                        'old_status' => $previousItemStatus,
                        'new_status' => $newItemStatus,
                        'updated_by_id' => $request->user()->id,
                        'updated_by_name' => $request->user()->name,
                        'updated_at' => now()->toIso8601String(),
                    ]
                );

                return [
                    'order' => $order->fresh(['items']), 'item' => $item->fresh(),
                    'previous_item_status' => $previousItemStatus, 'previous_order_status' => $previousOrderStatus,
                    'order_updated' => $orderUpdated, 'warning' => null, 'unchanged' => false,
                ];
            });

            $newOrderStatus = $result['order']->status->value ?? (string) $result['order']->status;
            $label = OrderStatus::tryFrom($result['item']->production_status)?->label() ?? ucwords(str_replace('_', ' ', $result['item']->production_status));
            return response()->json([
                'success' => true,
                'message' => $result['unchanged']
                    ? 'This product already has that status.'
                    : ($result['order_updated']
                        ? "Product and order moved to {$label}; the customer was notified."
                        : "Product moved to {$label}. The order status and customer notification update when every product reaches the same stage."),
                'data' => [
                    'id' => $result['order']->id,
                    'order_number' => $result['order']->order_number,
                    'item_id' => $result['item']->id,
                    'item_name' => $result['item']->product_name,
                    'status' => $result['item']->production_status,
                    'status_label' => $label,
                    'previous_item_status' => $result['previous_item_status'],
                    'order_status' => $newOrderStatus,
                    'previous_order_status' => $result['previous_order_status'],
                    'order_status_updated' => $result['order_updated'],
                    'warning' => $result['warning'],
                ],
            ]);
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Could not update product status.',
                'errors' => $exception->errors(),
            ], 422);
        }
    }

    private function orderStatusForItemStatus(string $itemStatus): ?string
    {
        return match ($itemStatus) {
            'prepress' => 'artwork_review',
            'approved' => 'approved',
            'printing', 'in_production', 'production_started' => 'printing',
            'cutting_and_finishing', 'cutting_in_progress' => 'cutting_and_finishing',
            'quality_check_and_packaging', 'production_completed' => 'quality_check_and_packaging',
            'ready_for_pickup' => 'ready_for_pickup',
            'ready_for_shipping' => 'ready_for_shipping',
            'dispatched' => 'dispatched',
            'handed_over_to_courier' => 'handed_over_to_courier',
            'delivered' => 'delivered',
            'collected' => 'collected',
            'cancelled' => 'cancelled',
            default => null,
        };
    }

    private function station(string $stage): array
    {
        abort_unless(isset(self::STATIONS[$stage]), 404, 'Unknown production station.');
        return self::STATIONS[$stage];
    }

    private function targetStatus(string $stage, Order $order): ?string
    {
        if ($stage !== 'ready_for_dispatch') {
            return self::STATIONS[$stage]['to'];
        }

        $isPickup = str_contains(strtolower((string) $order->delivery_method), 'pickup');
        return $isPickup ? 'ready_for_pickup' : 'ready_for_shipping';
    }

    private function targetLabel(string $stage, Order $order): string
    {
        $status = $this->targetStatus($stage, $order);
        return $status ? (OrderStatus::tryFrom($status)?->label() ?? ucwords(str_replace('_', ' ', $status))) : self::STATIONS[$stage]['label'];
    }

    private function itemFromStatuses(string $stage): array
    {
        return match ($stage) {
            'printing' => ['queued', 'prepress', 'approved', 'in_production', 'production_started'],
            'cutting_and_finishing' => ['printing', 'cutting_in_progress'],
            'quality_check_and_packaging' => ['cutting_and_finishing', 'cutting_in_progress'],
            'ready_for_dispatch' => ['quality_check_and_packaging', 'production_completed'],
            'handed_over_to_courier' => ['ready_for_shipping', 'dispatched'],
            'delivered' => ['handed_over_to_courier', 'dispatched'],
            'collected' => ['ready_for_pickup'],
            default => [],
        };
    }

    private function itemTargetStatus(string $stage, Order $order): string
    {
        if ($stage === 'ready_for_dispatch') {
            return str_contains(strtolower((string) $order->delivery_method), 'pickup') ? 'ready_for_pickup' : 'ready_for_shipping';
        }
        return self::STATIONS[$stage]['to'] ?? $stage;
    }
}
