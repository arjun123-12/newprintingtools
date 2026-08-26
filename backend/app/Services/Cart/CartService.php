<?php

namespace App\Services\Cart;

class CartService
{
    public function getOrCreateCart(?string $sessionId, ?int $userId): array
    {
        return [
            'items' => [],
            'subtotal' => 0.00,
        ];
    }
}
