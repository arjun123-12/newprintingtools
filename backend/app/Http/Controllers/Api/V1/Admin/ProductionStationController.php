<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
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
        $station = $this->station($stage);
        $query = Order::query()
            ->with(['user:id,name,email,company_name,phone', 'items:id,order_id,product_name,quantity'])
            ->whereIn('status', $station['from'])
            ->latest('created_at');

        $orders = $query->limit(200)->get()->filter(function (Order $order) use ($stage, $station) {
            $currentStatus = $order->status->value ?? (string) $order->status;
            if (!in_array($currentStatus, $station['from'], true)) {
                return false;
            }
            if ($stage === 'printing' && $currentStatus === 'approved') {
                return ($order->payment_status->value ?? (string) $order->payment_status) === 'paid';
            }
            if ($stage === 'handed_over_to_courier') {
                return !str_contains(strtolower((string) $order->delivery_method), 'pickup');
            }
            return true;
        })->values()->map(function (Order $order) use ($stage) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->user?->name ?? ($order->shipping_address['name'] ?? 'Guest Customer'),
                'customer_email' => $order->shipping_address['email'] ?? $order->user?->email,
                'status' => $order->status->value ?? (string) $order->status,
                'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                'delivery_method' => $order->delivery_method,
                'product_summary' => $order->items->map(fn ($item) => $item->product_name . ' × ' . $item->quantity)->implode(', '),
                'target_status' => $this->targetStatus($stage, $order),
                'target_label' => $this->targetLabel($stage, $order),
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
            'shipping_carrier' => ['nullable', 'string', 'max:150'],
            'tracking_number' => ['nullable', 'string', 'max:150'],
        ]);

        try {
            $order = DB::transaction(function () use ($id, $stage, $station, $validated, $request, $manualOrderService) {
                $order = Order::query()->where('id', $id)->orWhere('order_number', $id)->lockForUpdate()->firstOrFail();
                $currentStatus = $order->status->value ?? (string) $order->status;
                $targetStatus = $this->targetStatus($stage, $order);

                $isEligible = $targetStatus && in_array($currentStatus, $station['from'], true);
                if ($stage === 'printing' && $currentStatus === 'approved') {
                    $isPaid = ($order->payment_status->value ?? (string) $order->payment_status) === 'paid';
                    if (!$isPaid) {
                        throw ValidationException::withMessages([
                            'order' => 'Payment warning: this order is not paid yet, so printing cannot start.',
                        ]);
                    }
                    $isEligible = $isEligible && $isPaid;
                }
                if ($stage === 'handed_over_to_courier' && str_contains(strtolower((string) $order->delivery_method), 'pickup')) {
                    throw ValidationException::withMessages([
                        'order' => 'Delivery warning: this order is for store pickup. Scan it at the Collected station instead of Courier Handoff.',
                    ]);
                }

                if (!$isEligible) {
                    $currentLabel = OrderStatus::tryFrom($currentStatus)?->label() ?? ucwords(str_replace('_', ' ', $currentStatus));
                    $requiredLabels = collect($station['from'])
                        ->map(fn (string $status) => OrderStatus::tryFrom($status)?->label() ?? ucwords(str_replace('_', ' ', $status)))
                        ->unique()
                        ->implode(' or ');
                    throw ValidationException::withMessages([
                        'order' => "Stage sequence warning: order {$order->order_number} is currently at {$currentLabel}; {$station['label']} expects {$requiredLabels} first. The status was not changed. Scan it at the required previous station or check the order history.",
                    ]);
                }

                return $manualOrderService->updateProductionStatus(
                    $order,
                    $targetStatus,
                    $request->user(),
                    $validated['shipping_carrier'] ?? null,
                    $validated['tracking_number'] ?? null
                );
            });

            return response()->json([
                'success' => true,
                'message' => 'Order moved to ' . $this->targetLabel($stage, $order) . '.',
                'data' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status->value ?? (string) $order->status,
                    'status_label' => $this->targetLabel($stage, $order),
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
}
