<?php

namespace App\Services\Order;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Cart;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Services\Checkout\CheckoutService;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        protected CheckoutService $checkoutService
    ) {}

    /**
     * Create a pending order from the authenticated user's cart and checkout data.
     *
     * Flow:
     * 1. Validate customer & address inputs
     * 2. Authoritatively recalculate prices, GST, and shipping on the backend
     * 3. Wrap Order and OrderItem creation inside a strict database transaction
     * 4. Preserve artwork associations, options snapshot, and address snapshots
     * 5. Leave the cart intact until payment succeeds in the next stage
     *
     * @throws ValidationException
     * @throws Exception
     */
    public function createOrderFromCheckout(User $user, array $data): Order
    {
        // 1. Authoritative validation & recalculation via CheckoutService
        // Never trusts frontend prices, subtotal, GST, or total
        $validationResult = $this->checkoutService->validateCheckout($user, $data);

        // 2. Fetch the user's cart (already ownership-verified by CheckoutService)
        $cart = Cart::where('user_id', $user->id)
            ->with(['items.product', 'items.artwork'])
            ->first();

        if (!$cart || $cart->items->isEmpty()) {
            throw ValidationException::withMessages([
                'cart' => ['Your shopping cart is empty. Please add items to your cart before proceeding.'],
            ]);
        }

        // 3. Generate unique order number (e.g. PO-2026-A1B2C3)
        $orderNumber = $this->generateUniqueOrderNumber();

        // 4. Prepare frozen address snapshots
        $shipping = $validationResult['shipping_address'];
        $billing = $validationResult['billing_address'];

        $shippingAddressSnapshot = [
            'name' => $shipping['name'],
            'email' => $data['email'] ?? $user->email,
            'phone' => $shipping['phone'],
            'company' => $shipping['company'] ?? null,
            'address_line_1' => $shipping['address_line_1'],
            'address_line_2' => $shipping['address_line_2'] ?? null,
            'city' => $shipping['city'] ?? $shipping['suburb'] ?? '',
            'state' => strtoupper($shipping['state']),
            'postcode' => $shipping['postcode'],
            'country' => 'AU',
        ];

        $billingAddressSnapshot = [
            'name' => $billing['name'],
            'email' => $data['email'] ?? $user->email,
            'phone' => $billing['phone'],
            'company' => $billing['company'] ?? null,
            'address_line_1' => $billing['address_line_1'],
            'address_line_2' => $billing['address_line_2'] ?? null,
            'city' => $billing['city'] ?? $billing['suburb'] ?? '',
            'state' => strtoupper($billing['state']),
            'postcode' => $billing['postcode'],
            'country' => 'AU',
        ];

        // 5. Database transaction: create order and order items atomically
        return DB::transaction(function () use (
            $user,
            $cart,
            $validationResult,
            $orderNumber,
            $shippingAddressSnapshot,
            $billingAddressSnapshot,
            $data
        ) {
            // Create Order record with pending status
            $order = Order::create([
                'order_number' => $orderNumber,
                'user_id' => $user->id,
                'status' => OrderStatus::PENDING_PAYMENT,
                'payment_status' => PaymentStatus::UNPAID,
                'subtotal_ex_gst' => $validationResult['subtotal_ex_gst'],
                'gst_amount' => $validationResult['gst_amount'],
                'shipping_fee_inc_gst' => $validationResult['shipping'],
                'discount_amount' => $validationResult['discount'] ?? 0.00,
                'total_inc_gst' => $validationResult['total'],
                'currency' => 'AUD',
                'shipping_address' => $shippingAddressSnapshot,
                'billing_address' => $billingAddressSnapshot,
                'shipping_carrier' => $validationResult['shipping_method']['name'] ?? 'Australia Post Standard',
                'customer_notes' => $data['customer_notes'] ?? $data['notes'] ?? null,
            ]);

            // Create OrderItems from cart items
            $itemsMap = collect($validationResult['items'])->keyBy('id');

            foreach ($cart->items as $cartItem) {
                $product = $cartItem->product;
                $recalculated = $itemsMap->get($cartItem->id);

                $unitPriceExGst = $recalculated['unit_price_ex_gst'] ?? $cartItem->unit_price_ex_gst;
                $unitPriceIncGst = $recalculated['unit_price_inc_gst'] ?? round($unitPriceExGst * 1.10, 4);
                $totalPriceIncGst = $recalculated['total_inc_gst'] ?? round($unitPriceIncGst * $cartItem->quantity, 2);

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_sku' => $product->sku ?: ('PRD-' . strtoupper(substr(str_replace('-', '', $product->id), 0, 8))),
                    'quantity' => $cartItem->quantity,
                    'unit_price_ex_gst' => $unitPriceExGst,
                    'unit_price_inc_gst' => $unitPriceIncGst,
                    'total_price_inc_gst' => $totalPriceIncGst,
                    'options_snapshot' => $cartItem->selected_options ?? [],
                    'artwork_id' => $cartItem->artwork_id,
                    'designer_canvas_state' => $cartItem->design_canvas_json,
                    'production_status' => 'queued',
                ]);
            }

            Log::info("Order {$order->order_number} created successfully for user {$user->id}. Total: AUD {$order->total_inc_gst}");

            // DO NOT clear cart here - cart remains intact until payment verification in next stage
            return $order->load(['items.product', 'items.artwork', 'user:id,name,email,phone']);
        });
    }

    /**
     * Generate a unique, professional order number.
     * Format: PO-YYYY-XXXXXX
     */
    protected function generateUniqueOrderNumber(): string
    {
        $year = date('Y');
        do {
            $randomCode = strtoupper(Str::random(6));
            $orderNumber = "PO-{$year}-{$randomCode}";
        } while (Order::where('order_number', $orderNumber)->exists());

        return $orderNumber;
    }
}
