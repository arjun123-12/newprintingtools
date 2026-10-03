<?php

namespace App\Http\Controllers\Api\V1\Checkout;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use App\Services\Checkout\CheckoutService;
use App\Services\Order\OrderService;
use App\Services\Payment\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function __construct(
        protected CheckoutService $checkoutService,
        protected OrderService $orderService,
        protected PaymentService $paymentService
    ) {}

    /**
     * Retrieve user-specific cart and checkout initialization data.
     */
    public function getCheckoutData(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->header('X-Session-ID');

        $data = $this->checkoutService->getCheckoutData($user, $sessionId);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Validate checkout details, verify stock & recalculate server-side totals.
     */
    public function validateCheckout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipping_address' => ['required', 'array'],
            'shipping_address.name' => ['required', 'string', 'min:2', 'max:100'],
            'shipping_address.email' => ['required', 'email', 'max:150'],
            'shipping_address.phone' => ['required', 'string', 'min:8', 'max:20'],
            'shipping_address.company' => ['nullable', 'string', 'max:100'],
            'shipping_address.address_line_1' => ['required', 'string', 'min:3', 'max:255'],
            'shipping_address.address_line_2' => ['nullable', 'string', 'max:255'],
            'shipping_address.city' => ['required', 'string', 'min:2', 'max:100'],
            'shipping_address.state' => [
                'required',
                'string',
                'regex:/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/i',
            ],
            'shipping_address.postcode' => ['required', 'string', 'regex:/^[0-9]{4}$/'],
            'shipping_address.country' => ['nullable', 'string'],

            'billing_address_same_as_shipping' => ['nullable', 'boolean'],
            'billing_address' => ['nullable', 'array'],
            'billing_address.name' => ['required_if:billing_address_same_as_shipping,false', 'nullable', 'string', 'min:2', 'max:100'],
            'billing_address.phone' => ['required_if:billing_address_same_as_shipping,false', 'nullable', 'string', 'min:8', 'max:20'],
            'billing_address.company' => ['nullable', 'string', 'max:100'],
            'billing_address.address_line_1' => ['required_if:billing_address_same_as_shipping,false', 'nullable', 'string', 'min:3', 'max:255'],
            'billing_address.address_line_2' => ['nullable', 'string', 'max:255'],
            'billing_address.city' => ['required_if:billing_address_same_as_shipping,false', 'nullable', 'string', 'min:2', 'max:100'],
            'billing_address.state' => [
                'required_if:billing_address_same_as_shipping,false',
                'nullable',
                'string',
                'regex:/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/i',
            ],
            'billing_address.postcode' => ['required_if:billing_address_same_as_shipping,false', 'nullable', 'string', 'regex:/^[0-9]{4}$/'],
            'billing_address.country' => ['nullable', 'string'],

            'shipping_method_id' => ['required', 'string', 'in:auspost_standard,auspost_express,startrack_premium'],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
            'save_address' => ['nullable', 'boolean'],
        ], [
            'shipping_address.postcode.regex' => 'Please enter a valid 4-digit Australian postcode.',
            'shipping_address.state.regex' => 'State must be a valid Australian state or territory (e.g. NSW, VIC, QLD, WA, SA, TAS, ACT, NT).',
            'billing_address.postcode.regex' => 'Billing postcode must be a valid 4-digit Australian postcode.',
            'billing_address.state.regex' => 'Billing state must be a valid Australian state or territory.',
        ]);

        $user = $request->user();
        $validatedData = $this->checkoutService->validateCheckout($user, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Checkout details validated successfully.',
            'data' => $validatedData,
        ]);
    }

    /**
     * Retrieve customer saved addresses.
     */
    public function getAddresses(Request $request): JsonResponse
    {
        $addresses = UserAddress::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $addresses,
        ]);
    }

    /**
     * Save a customer address.
     */
    public function saveAddress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:shipping,billing'],
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'company' => ['nullable', 'string', 'max:100'],
            'address_line_1' => ['required', 'string', 'min:3', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'state' => ['required', 'string', 'regex:/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/i'],
            'postcode' => ['required', 'string', 'regex:/^[0-9]{4}$/'],
            'phone' => ['required', 'string', 'min:8', 'max:20'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();

        if (!empty($validated['is_default'])) {
            UserAddress::where('user_id', $user->id)
                ->where('type', $validated['type'])
                ->update(['is_default' => false]);
        }

        $address = UserAddress::create([
            'user_id' => $user->id,
            'type' => $validated['type'],
            'name' => $validated['name'],
            'company' => $validated['company'] ?? null,
            'address_line_1' => $validated['address_line_1'],
            'address_line_2' => $validated['address_line_2'] ?? null,
            'suburb' => $validated['city'],
            'state' => strtoupper($validated['state']),
            'postcode' => $validated['postcode'],
            'country' => 'AU',
            'phone' => $validated['phone'],
            'is_default' => !empty($validated['is_default']),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Address saved successfully.',
            'data' => $address,
        ], 201);
    }

    /**
     * Process checkout and create pending order.
     */
    public function process(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipping_address' => 'required|array',
            'billing_address' => 'nullable|array',
            'billing_address_same_as_shipping' => 'nullable|boolean',
            'shipping_method_id' => 'required|string',
            'customer_notes' => 'nullable|string|max:1000',
        ]);

        $order = $this->orderService->createOrderFromCheckout($request->user(), $validated);

        return response()->json([
            'success' => true,
            'message' => 'Order created successfully. Pending payment.',
            'data' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status->value,
                'payment_status' => $order->payment_status->value,
                'total' => (float) $order->total_inc_gst,
                'currency' => $order->currency,
            ],
        ], 201);
    }
}
