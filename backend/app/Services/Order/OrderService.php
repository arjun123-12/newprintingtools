<?php

namespace App\Services\Order;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;

class OrderService
{
    /**
     * Create an order from cart and shipping details
     */
    public function createOrder(array $orderData): array
    {
        return [
            'order_number' => 'PO-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6)),
            'status' => OrderStatus::PENDING_PAYMENT->value,
            'payment_status' => PaymentStatus::UNPAID->value,
        ];
    }
}
