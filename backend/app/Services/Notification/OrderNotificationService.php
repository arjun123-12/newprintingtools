<?php

namespace App\Services\Notification;

class OrderNotificationService
{
    public function sendOrderConfirmation(string $orderNumber, string $customerEmail): void
    {
        // Dispatched to async queue
    }

    public function sendArtworkStatusUpdate(string $orderNumber, string $customerEmail, string $status): void
    {
        // Dispatched to async queue
    }
}
