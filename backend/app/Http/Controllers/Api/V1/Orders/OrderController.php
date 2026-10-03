<?php

namespace App\Http\Controllers\Api\V1\Orders;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Order\OrderService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(
        protected OrderService $orderService
    ) {}

    /**
     * List authenticated customer orders.
     */
    public function index(Request $request): JsonResponse
    {
        $orders = Order::where('user_id', $request->user()->id)
            ->with(['items.product', 'items.artwork', 'invoice'])
            ->latest()
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    /**
     * Create a new pending order from the user's cart and checkout submission.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipping_address' => ['required', 'array'],
            'shipping_address.name' => ['required', 'string', 'min:2', 'max:100'],
            'shipping_address.email' => ['nullable', 'email', 'max:150'],
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
            'billing_address.postcode' => [
                'required_if:billing_address_same_as_shipping,false',
                'nullable',
                'string',
                'regex:/^[0-9]{4}$/',
            ],
            'billing_address.country' => ['nullable', 'string'],

            'shipping_method_id' => ['required', 'string'],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'save_address' => ['nullable', 'boolean'],
        ]);

        try {
            $user = $request->user();
            $order = $this->orderService->createOrderFromCheckout($user, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Order created successfully. Pending payment.',
                'data' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status->value,
                    'payment_status' => $order->payment_status->value,
                    'subtotal_ex_gst' => (float) $order->subtotal_ex_gst,
                    'gst_amount' => (float) $order->gst_amount,
                    'shipping_fee_inc_gst' => (float) $order->shipping_fee_inc_gst,
                    'discount_amount' => (float) $order->discount_amount,
                    'total_inc_gst' => (float) $order->total_inc_gst,
                    'total' => (float) $order->total_inc_gst,
                    'currency' => $order->currency ?? 'AUD',
                    'customer' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                    ],
                    'shipping_address' => $order->shipping_address,
                    'billing_address' => $order->billing_address,
                    'shipping_carrier' => $order->shipping_carrier,
                    'customer_notes' => $order->customer_notes,
                    'items_count' => (int) $order->items->sum('quantity'),
                    'items' => $order->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'product_id' => $item->product_id,
                            'product_name' => $item->product_name,
                            'product_sku' => $item->product_sku,
                            'quantity' => $item->quantity,
                            'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                            'unit_price_inc_gst' => (float) $item->unit_price_inc_gst,
                            'total_price_inc_gst' => (float) $item->total_price_inc_gst,
                            'options_snapshot' => $item->options_snapshot,
                            'artwork_id' => $item->artwork_id,
                            'artwork' => $item->artwork ? [
                                'id' => $item->artwork->id,
                                'name' => $item->artwork->name,
                                'thumbnail_url' => $item->artwork->thumbnail_url,
                                'width' => $item->artwork->width,
                                'height' => $item->artwork->height,
                                'unit' => $item->artwork->unit,
                            ] : null,
                            'production_status' => $item->production_status,
                        ];
                    }),
                    'created_at' => $order->created_at->toIso8601String(),
                ],
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to create order. Please review your cart and details.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Show single order details by order_number or UUID.
     * Strictly scopes to the authenticated user.
     */
    public function show(Request $request, string $identifier): JsonResponse
    {
        $order = Order::where('user_id', $request->user()->id)
            ->where(function ($q) use ($identifier) {
                $q->where('order_number', $identifier)
                  ->orWhere('id', $identifier);
            })
            ->with(['items.product', 'items.artwork', 'invoice', 'payments'])
            ->first();

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found or access unauthorized.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status->value,
                'payment_status' => $order->payment_status->value,
                'subtotal_ex_gst' => (float) $order->subtotal_ex_gst,
                'gst_amount' => (float) $order->gst_amount,
                'shipping_fee_inc_gst' => (float) $order->shipping_fee_inc_gst,
                'discount_amount' => (float) $order->discount_amount,
                'total_inc_gst' => (float) $order->total_inc_gst,
                'total' => (float) $order->total_inc_gst,
                'currency' => $order->currency ?? 'AUD',
                'customer' => [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'phone' => $request->user()->phone,
                ],
                'shipping_address' => $order->shipping_address,
                'billing_address' => $order->billing_address,
                'shipping_carrier' => $order->shipping_carrier,
                'customer_notes' => $order->customer_notes,
                'items_count' => (int) $order->items->sum('quantity'),
                'items' => $order->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'product_sku' => $item->product_sku,
                        'quantity' => $item->quantity,
                        'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                        'unit_price_inc_gst' => (float) $item->unit_price_inc_gst,
                        'total_price_inc_gst' => (float) $item->total_price_inc_gst,
                        'options_snapshot' => $item->options_snapshot,
                        'artwork_id' => $item->artwork_id,
                        'artwork' => $item->artwork ? [
                            'id' => $item->artwork->id,
                            'name' => $item->artwork->name,
                            'thumbnail_url' => $item->artwork->thumbnail_url,
                            'width' => $item->artwork->width,
                            'height' => $item->artwork->height,
                            'unit' => $item->artwork->unit,
                        ] : null,
                        'production_status' => $item->production_status,
                    ];
                }),
                'created_at' => $order->created_at->toIso8601String(),
            ],
        ]);
    }
}
