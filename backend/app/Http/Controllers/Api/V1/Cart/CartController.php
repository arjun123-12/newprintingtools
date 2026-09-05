<?php

namespace App\Http\Controllers\Api\V1\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CartController extends Controller
{
    public function __construct(
        protected CartService $cartService
    ) {}

    /**
     * Resolve authenticated Sanctum user even on unauthenticated route groups.
     */
    protected function resolveUser(Request $request)
    {
        return $request->user('sanctum') ?? auth('sanctum')->user() ?? $request->user();
    }

    /**
     * Get the active session ID or header.
     */
    protected function resolveSessionId(Request $request): ?string
    {
        return $request->header('X-Session-ID')
            ?? $request->input('session_id')
            ?? ($request->hasSession() ? $request->session()->getId() : null);
    }

    /**
     * Retrieve the current customer or guest cart.
     */
    public function getCart(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        $sessionId = $this->resolveSessionId($request);

        $cart = $this->cartService->getOrCreateCart($sessionId, $user?->id);
        $formatted = $this->cartService->formatCart($cart);

        return response()->json([
            'success' => true,
            'data' => $formatted,
        ]);
    }

    /**
     * Add a product item (with optional custom artwork) to the cart.
     */
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'required',
                'uuid',
                Rule::exists('products', 'id'),
            ],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'selected_options' => ['nullable', 'array'],
            'artwork_id' => [
                'nullable',
                'uuid',
                Rule::exists('artworks', 'id'),
            ],
            'design_canvas_json' => ['nullable', 'array'],
        ]);

        $user = $this->resolveUser($request);
        $sessionId = $this->resolveSessionId($request);

        $cart = $this->cartService->getOrCreateCart($sessionId, $user?->id);
        $item = $this->cartService->addItem($cart, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Product design added to your cart successfully.',
            'data' => [
                'item' => $item,
                'cart' => $this->cartService->formatCart($cart),
            ],
        ], 201);
    }

    /**
     * Update quantity and selected options for a cart item.
     */
    public function updateItem(Request $request, string $itemId): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'selected_options' => ['nullable', 'array'],
        ]);

        $user = $this->resolveUser($request);
        $sessionId = $this->resolveSessionId($request);

        $cart = $this->cartService->getOrCreateCart($sessionId, $user?->id);
        $item = $this->cartService->updateItem(
            $cart,
            $itemId,
            $validated['quantity'],
            $validated['selected_options'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'Cart item updated successfully.',
            'data' => [
                'item' => $item,
                'cart' => $this->cartService->formatCart($cart),
            ],
        ]);
    }

    /**
     * Remove an item from the cart.
     */
    public function removeItem(Request $request, string $itemId): JsonResponse
    {
        $user = $this->resolveUser($request);
        $sessionId = $this->resolveSessionId($request);

        $cart = $this->cartService->getOrCreateCart($sessionId, $user?->id);
        $this->cartService->removeItem($cart, $itemId);

        return response()->json([
            'success' => true,
            'message' => 'Item removed from your cart.',
            'data' => [
                'cart' => $this->cartService->formatCart($cart),
            ],
        ]);
    }

    /**
     * Clear all items from the cart.
     */
    public function clearCart(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        $sessionId = $this->resolveSessionId($request);

        $cart = $this->cartService->getOrCreateCart($sessionId, $user?->id);
        $this->cartService->clearCart($cart);

        return response()->json([
            'success' => true,
            'message' => 'Cart cleared successfully.',
            'data' => [
                'cart' => $this->cartService->formatCart($cart),
            ],
        ]);
    }
}
