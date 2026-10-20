<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Order\ManualOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class AdminOrderController extends Controller
{
    public function __construct(
        protected ManualOrderService $manualOrderService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $search = trim((string) $request->query('search', ''));

        $query = Order::query()
            ->with(['user', 'items.product', 'payments', 'invoice'])
            ->latest('created_at');

        if (!empty($status) && $status !== 'all') {
            $query->where('status', $status);
        }

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        $orders = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $order = Order::with(['user', 'items.product', 'items.artwork', 'payments', 'invoice', 'activities'])
            ->where('id', $id)
            ->orWhere('order_number', $id)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $order,
        ]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string',
            'carrier' => 'nullable|string|max:150',
            'tracking_number' => 'nullable|string|max:150',
            'shipping_carrier' => 'nullable|string|max:150',
        ]);

        $order = Order::where('id', $id)->orWhere('order_number', $id)->firstOrFail();
        $adminUser = $request->user();

        try {
            $carrier = $validated['shipping_carrier'] ?? $validated['carrier'] ?? null;
            $trackingNumber = $validated['tracking_number'] ?? null;

            $updatedOrder = $this->manualOrderService->updateProductionStatus(
                $order,
                $validated['status'],
                $adminUser,
                $carrier,
                $trackingNumber
            );

            return response()->json([
                'success' => true,
                'message' => 'Order status updated successfully',
                'data' => $updatedOrder,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->validator->errors()->first(),
                'errors' => $e->validator->errors(),
            ], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Failed to update order status.',
            ], 422);
        }
    }
}
