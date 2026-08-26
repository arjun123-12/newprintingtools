<?php

namespace App\Http\Controllers\Api\V1\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(
        protected CartService $cartService
    ) {}

    public function getCart(Request $request): JsonResponse
    {
        $cart = $this->cartService->getOrCreateCart(
            $request->header('X-Session-ID'),
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'data' => $cart,
        ]);
    }

    public function addItem(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Item added to cart',
        ]);
    }

    public function updateItem(Request $request, string $itemId): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Cart item updated',
        ]);
    }

    public function removeItem(string $itemId): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Cart item removed',
        ]);
    }
}
