<?php

namespace App\Services\Checkout;

use App\Models\Artwork;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use App\Models\UserAddress;
use App\Services\Pricing\PricingCalculatorService;
use App\Services\Shipping\ShippingCalculatorService;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    const FREE_SHIPPING_THRESHOLD = 150.00;

    public function __construct(
        protected PricingCalculatorService $pricingCalculator,
        protected ShippingCalculatorService $shippingCalculator
    ) {}

    /**
     * Retrieve the initial checkout state for the authenticated user,
     * including their cart, saved addresses, and shipping options.
     */
    public function getCheckoutData(User $user, ?string $sessionId = null, ?array $addressOverride = null): array
    {
        // 1. Fetch user's cart from database
        $cart = Cart::where('user_id', $user->id)->first();

        // If user has a guest cart in this session, merge it
        if (!empty($sessionId)) {
            $guestCart = Cart::where('session_id', $sessionId)
                ->where(function ($q) use ($user) {
                    $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id);
                })
                ->first();

            if ($guestCart && $guestCart->id !== $cart?->id) {
                if (!$cart) {
                    $guestCart->update(['user_id' => $user->id]);
                    $cart = $guestCart;
                } else {
                    CartItem::where('cart_id', $guestCart->id)->update(['cart_id' => $cart->id]);
                    $guestCart->delete();
                }
            }
        }

        // 2. Load saved addresses
        $addresses = UserAddress::where('user_id', $user->id)->get();
        $defaultShipping = $addresses->firstWhere('is_default', true) 
            ?? $addresses->where('type', 'shipping')->first()
            ?? $addresses->first();
        $defaultBilling = $addresses->where('type', 'billing')->first() ?? $defaultShipping;

        if (!$cart || $cart->items()->count() === 0) {
            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'company_name' => $user->company_name,
                ],
                'is_empty' => true,
                'items' => [],
                'items_count' => 0,
                'subtotal_ex_gst' => 0.00,
                'gst_amount' => 0.00,
                'shipping' => 0.00,
                'discount' => 0.00,
                'total' => 0.00,
                'currency' => 'AUD',
                'saved_addresses' => $addresses,
                'default_shipping_address' => $defaultShipping,
                'default_billing_address' => $defaultBilling,
                'available_shipping_methods' => [],
            ];
        }

        // 3. Recalculate & format all cart items
        $recalculated = $this->recalculateCartItems($cart);

        // 4. Calculate available shipping rates (using address override if supplied)
        $postcode = (string) ($addressOverride['postcode'] ?? $defaultShipping?->postcode ?? '');
        $state = (string) ($addressOverride['state'] ?? $defaultShipping?->state ?? 'NSW');
        $suburb = (string) ($addressOverride['suburb'] ?? $addressOverride['city'] ?? $defaultShipping?->suburb ?? $defaultShipping?->city ?? '');
        $shippingRates = $this->getAvailableShippingRates($postcode, $state, $recalculated['subtotal_inc_gst'], $suburb);

        $selectedRate = $shippingRates[0] ?? [
            'id' => 'cp_standard',
            'carrier' => 'CouriersPlease',
            'name' => 'CouriersPlease Standard Delivery',
            'price_inc_gst' => 12.50,
            'estimated_days' => '2-4 Business Days',
        ];

        $shippingAmount = (float) $selectedRate['price_inc_gst'];
        $grandTotal = round($recalculated['subtotal_inc_gst'] + $shippingAmount, 2);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company_name' => $user->company_name,
            ],
            'is_empty' => false,
            'cart_id' => $cart->id,
            'items' => $recalculated['items'],
            'items_count' => $recalculated['items_count'],
            'subtotal_ex_gst' => $recalculated['subtotal_ex_gst'],
            'gst_amount' => $recalculated['gst_amount'],
            'shipping' => $shippingAmount,
            'discount' => 0.00,
            'total' => $grandTotal,
            'currency' => 'AUD',
            'saved_addresses' => $addresses,
            'default_shipping_address' => $defaultShipping,
            'default_billing_address' => $defaultBilling,
            'available_shipping_methods' => $shippingRates,
            'selected_shipping_method' => $selectedRate,
            'shipping_carrier_status' => $this->shippingCalculator->getCouriersPleaseService()->getConfigStatus(),
        ];
    }

    /**
     * Comprehensive backend checkout validation.
     * Never trusts frontend prices, tax, shipping, or totals.
     */
    public function validateCheckout(User $user, array $data): array
    {
        // 1. Load user's cart and enforce strict ownership
        $cart = Cart::where('user_id', $user->id)->first();

        if (!$cart || $cart->items()->count() === 0) {
            throw ValidationException::withMessages([
                'cart' => ['Your shopping cart is empty. Please add products before checking out.'],
            ]);
        }

        // 2. Verify all products and recalculate prices
        $recalculated = $this->recalculateCartItems($cart);

        // 3. Shipping address extraction
        $shipping = $data['shipping_address'];
        $billing = (!empty($data['billing_address_same_as_shipping']) || empty($data['billing_address']))
            ? $shipping
            : $data['billing_address'];

        // 4. Calculate shipping rate
        $postcode = (string) ($shipping['postcode'] ?? '');
        $state = (string) ($shipping['state'] ?? 'NSW');
        $suburb = (string) ($shipping['suburb'] ?? $shipping['city'] ?? '');
        $availableRates = $this->getAvailableShippingRates($postcode, $state, $recalculated['subtotal_inc_gst'], $suburb);

        $chosenMethodId = $data['shipping_method_id'] ?? 'cp_standard';
        $selectedRate = collect($availableRates)->firstWhere('id', $chosenMethodId);

        if (!$selectedRate) {
            $selectedRate = $availableRates[0] ?? [
                'id' => 'cp_standard',
                'carrier' => 'CouriersPlease',
                'name' => 'CouriersPlease Standard Delivery',
                'price_inc_gst' => 12.50,
                'estimated_days' => '2-4 Business Days',
            ];
        }

        $shippingAmount = (float) $selectedRate['price_inc_gst'];

        // Validate optional Spin & Win reward voucher for future orders
        $discount = 0.00;
        $rewardCode = !empty($data['reward_code']) ? $data['reward_code'] : ($data['voucher_code'] ?? null);
        if (!empty($rewardCode)) {
            $spinService = app(\App\Services\Rewards\SpinRewardService::class);
            $rewardValidation = $spinService->validateRewardForCheckout($rewardCode, (float) $recalculated['subtotal_inc_gst'], $user);
            if ($rewardValidation['valid'] ?? false) {
                $discount = (float) ($rewardValidation['discount_amount'] ?? 0.00);
            }
        }

        $grandTotal = max(0.00, round($recalculated['subtotal_inc_gst'] + $shippingAmount - $discount, 2));

        // 5. Persist/update user address in database (deduplicating existing addresses)
        $savedShippingAddress = $this->saveOrUpdateUserAddress($user, $shipping, 'shipping');
        $savedBillingAddress = empty($data['billing_address_same_as_shipping']) && !empty($data['billing_address'])
            ? $this->saveOrUpdateUserAddress($user, $billing, 'billing')
            : $savedShippingAddress;

        return [
            'valid' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company_name' => $user->company_name,
            ],
            'cart_id' => $cart->id,
            'items' => $recalculated['items'],
            'items_count' => $recalculated['items_count'],
            'subtotal_ex_gst' => $recalculated['subtotal_ex_gst'],
            'gst_amount' => $recalculated['gst_amount'],
            'shipping' => $shippingAmount,
            'shipping_method' => $selectedRate,
            'discount' => $discount,
            'reward_code' => $rewardCode,
            'total' => $grandTotal,
            'currency' => 'AUD',
            'shipping_address' => [
                'id' => $savedShippingAddress->id,
                'name' => $shipping['name'],
                'phone' => $shipping['phone'],
                'company' => $shipping['company'] ?? null,
                'address_line_1' => $shipping['address_line_1'],
                'address_line_2' => $shipping['address_line_2'] ?? null,
                'city' => $shipping['city'] ?? $shipping['suburb'] ?? '',
                'suburb' => $shipping['city'] ?? $shipping['suburb'] ?? '',
                'state' => strtoupper($shipping['state']),
                'postcode' => $shipping['postcode'],
                'country' => 'AU',
            ],
            'billing_address' => [
                'id' => $savedBillingAddress->id,
                'name' => $billing['name'],
                'phone' => $billing['phone'],
                'company' => $billing['company'] ?? null,
                'address_line_1' => $billing['address_line_1'],
                'address_line_2' => $billing['address_line_2'] ?? null,
                'city' => $billing['city'] ?? $billing['suburb'] ?? '',
                'suburb' => $billing['city'] ?? $billing['suburb'] ?? '',
                'state' => strtoupper($billing['state']),
                'postcode' => $billing['postcode'],
                'country' => 'AU',
            ],
            'billing_address_same_as_shipping' => !empty($data['billing_address_same_as_shipping']),
            'customer_notes' => $data['customer_notes'] ?? null,
            'validated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Recalculate each item in the cart from authoritative database models.
     */
    public function recalculateCartItems(Cart $cart): array
    {
        $cart->load([
            'items.product',
            'items.artwork',
        ]);

        $subtotalExGst = 0.00;
        $gstAmount = 0.00;
        $totalIncGst = 0.00;
        $itemsCount = 0;
        $formattedItems = [];

        foreach ($cart->items as $item) {
            $product = $item->product;

            if (!$product) {
                throw ValidationException::withMessages([
                    'cart' => ["One of the items in your cart is no longer available."],
                ]);
            }

            if ($product->is_active === false || $product->status === 'archived') {
                throw ValidationException::withMessages([
                    'cart' => ["The product '{$product->name}' is currently unavailable for order."],
                ]);
            }

            // Recalculate price using PricingCalculatorService
            $recalculatedPrice = $this->pricingCalculator->calculate([
                'product_id' => $product->id,
                'quantity' => $item->quantity,
                'selected_options' => $item->selected_options ?? [],
            ]);

            // Sync updated prices to cart item record
            $item->update([
                'unit_price_ex_gst' => $recalculatedPrice['unit_price_ex_gst'],
                'subtotal_ex_gst' => $recalculatedPrice['subtotal_ex_gst'],
                'gst_amount' => $recalculatedPrice['gst_amount'],
                'total_inc_gst' => $recalculatedPrice['total_inc_gst'],
            ]);

            $subtotalExGst += (float) $recalculatedPrice['subtotal_ex_gst'];
            $gstAmount += (float) $recalculatedPrice['gst_amount'];
            $totalIncGst += (float) $recalculatedPrice['total_inc_gst'];
            $itemsCount += (int) $item->quantity;

            // Thumbnail resolution: artwork thumbnail > product image
            $thumbnailUrl = $item->artwork?->thumbnail_url
                ?? $product->featured_image_url
                ?? null;

            $formattedItems[] = [
                'id' => $item->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_slug' => $product->slug,
                'product_sku' => $product->sku,
                'thumbnail_url' => $thumbnailUrl,
                'quantity' => $item->quantity,
                'selected_options' => $item->selected_options ?? [],
                'artwork_id' => $item->artwork_id,
                'artwork' => $item->artwork ? [
                    'id' => $item->artwork->id,
                    'name' => $item->artwork->name,
                    'thumbnail_url' => $item->artwork->thumbnail_url,
                    'width_px' => $item->artwork->width_px,
                    'height_px' => $item->artwork->height_px,
                    'dpi' => $item->artwork->dpi,
                    'unit' => $item->artwork->unit,
                ] : null,
                'unit_price_ex_gst' => (float) $recalculatedPrice['unit_price_ex_gst'],
                'unit_price_inc_gst' => (float) $recalculatedPrice['unit_price_inc_gst'],
                'subtotal_ex_gst' => (float) $recalculatedPrice['subtotal_ex_gst'],
                'gst_amount' => (float) $recalculatedPrice['gst_amount'],
                'total_inc_gst' => (float) $recalculatedPrice['total_inc_gst'],
            ];
        }

        return [
            'items' => $formattedItems,
            'items_count' => $itemsCount,
            'subtotal_ex_gst' => round($subtotalExGst, 2),
            'gst_amount' => round($gstAmount, 2),
            'subtotal_inc_gst' => round($totalIncGst, 2),
        ];
    }

    /**
     * Compute available shipping options, applying Free Standard Shipping over $150 AUD.
     */
    public function getAvailableShippingRates(string $postcode, string $state, float $subtotalIncGst, string $suburb = '', array $items = []): array
    {
        $rawRates = $this->shippingCalculator->calculateRates($postcode, $state, 1.0, $suburb, $items);

        return array_map(function ($rate) use ($subtotalIncGst) {
            $isStandard = str_contains($rate['id'], 'standard');
            $isFree = $isStandard && ($subtotalIncGst >= self::FREE_SHIPPING_THRESHOLD);

            return [
                'id' => $rate['id'],
                'carrier' => $rate['carrier'] ?? 'CouriersPlease',
                'name' => $rate['name'],
                'rate_card_code' => $rate['rate_card_code'] ?? null,
                'price_inc_gst' => $isFree ? 0.00 : (float) $rate['price_inc_gst'],
                'original_price' => (float) $rate['price_inc_gst'],
                'is_free' => $isFree,
                'estimated_days' => $rate['estimated_days'],
                'cutoff_time' => $rate['cutoff_time'] ?? null,
            ];
        }, $rawRates);
    }

    /**
     * Save or update customer address to avoid creating duplicate records on each visit.
     */
    protected function saveOrUpdateUserAddress(User $user, array $addressData, string $type): UserAddress
    {
        $suburb = $addressData['city'] ?? $addressData['suburb'] ?? '';
        $state = strtoupper($addressData['state'] ?? 'NSW');
        $postcode = (string) ($addressData['postcode'] ?? '');
        $line1 = trim($addressData['address_line_1'] ?? '');

        // Search for existing address with matching street address and postcode
        $existing = UserAddress::where('user_id', $user->id)
            ->where('type', $type)
            ->where('address_line_1', $line1)
            ->where('postcode', $postcode)
            ->first();

        if ($existing) {
            $existing->update([
                'name' => $addressData['name'] ?? $existing->name,
                'company' => $addressData['company'] ?? $existing->company,
                'address_line_2' => $addressData['address_line_2'] ?? $existing->address_line_2,
                'suburb' => $suburb,
                'state' => $state,
                'phone' => $addressData['phone'] ?? $existing->phone,
                'is_default' => true,
            ]);
            return $existing;
        }

        // Set previous default to false
        UserAddress::where('user_id', $user->id)
            ->where('type', $type)
            ->update(['is_default' => false]);

        return UserAddress::create([
            'user_id' => $user->id,
            'type' => $type,
            'name' => $addressData['name'],
            'company' => $addressData['company'] ?? null,
            'address_line_1' => $line1,
            'address_line_2' => $addressData['address_line_2'] ?? null,
            'suburb' => $suburb,
            'state' => $state,
            'postcode' => $postcode,
            'country' => 'AU',
            'phone' => $addressData['phone'],
            'is_default' => true,
        ]);
    }
}
