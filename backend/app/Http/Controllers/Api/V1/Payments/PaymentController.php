<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Payments\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class PaymentController extends Controller
{
    /**
     * Create a BPOINT payment session / AuthKey for an existing customer order.
     */
    public function createSession(
        Request $request,
        string $orderNumber,
        PaymentGatewayService $gateway
    ): JsonResponse {
        $order = Order::query()
            ->where('order_number', $orderNumber)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or unauthorized access.',
            ], 404);
        }

        if ($order->payment_status === PaymentStatus::PAID || ($order->payment_status->value ?? null) === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'This order is already paid.',
                'data' => [
                    'order_number' => $order->order_number,
                    'payment_status' => 'paid',
                    'paid' => true,
                ],
            ], 409);
        }

        try {
            $result = $gateway->createSession($order, $request->user()->email);

            if (! ($result['enabled'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'] ?? 'Payment gateway is currently disabled.',
                    'data' => [
                        'order_number' => $order->order_number,
                        'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                        'gateway_enabled' => false,
                    ],
                ], 503);
            }

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Unable to start payment.',
            ], 502);
        }
    }

    /**
     * Process and verify payment for an existing customer order.
     */
    public function processPayment(
        Request $request,
        string $orderNumber,
        PaymentGatewayService $gateway
    ): JsonResponse {
        $validated = $request->validate([
            'authkey' => ['required', 'string', 'min:5'],
        ]);

        $order = Order::query()
            ->where('order_number', $orderNumber)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or unauthorized access.',
            ], 404);
        }

        if ($order->payment_status === PaymentStatus::PAID || ($order->payment_status->value ?? null) === 'paid') {
            return response()->json([
                'success' => true,
                'message' => 'This order is already marked as paid.',
                'data' => [
                    'paid' => true,
                    'order_number' => $order->order_number,
                ],
            ]);
        }

        try {
            $result = $gateway->processPayment(
                $order,
                $validated['authkey'],
                $request->user()
            );

            if ($result['paid']) {
                return response()->json([
                    'success' => true,
                    'message' => $result['message'] ?? 'Payment approved successfully.',
                    'data' => $result,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'Payment could not be completed.',
                'data' => $result,
            ], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'An unexpected error occurred while verifying your payment.',
            ], 502);
        }
    }
}