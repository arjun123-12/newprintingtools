<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\Shipping\Carriers\CouriersPleaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class AdminShippingController extends Controller
{
    public function __construct(
        protected CouriersPleaseService $couriersPleaseService
    ) {}

    /**
     * Get carrier integration and dispatch origin configuration status.
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->couriersPleaseService->getConfigStatus(),
        ]);
    }

    /**
     * Update dispatch origin configuration in environment/runtime.
     */
    public function updateOrigin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'suburb' => 'required|string|max:100',
            'postcode' => 'required|string|max:10',
            'state' => 'nullable|string|max:3',
            'name' => 'nullable|string|max:50',
            'company_name' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address1' => 'nullable|string|max:100',
            'address2' => 'nullable|string|max:100',
        ]);

        $envPath = base_path('.env');
        if (file_exists($envPath)) {
            $envContent = file_get_contents($envPath);

            $replacements = [
                'COURIERS_PLEASE_DISPATCH_SUBURB' => $validated['suburb'],
                'COURIERS_PLEASE_DISPATCH_POSTCODE' => $validated['postcode'],
                'COURIERS_PLEASE_DISPATCH_STATE' => strtoupper($validated['state'] ?? 'NSW'),
            ];

            if (!empty($validated['name'])) {
                $replacements['COURIERS_PLEASE_DISPATCH_NAME'] = '"' . $validated['name'] . '"';
            }
            if (!empty($validated['company_name'])) {
                $replacements['COURIERS_PLEASE_DISPATCH_COMPANY'] = '"' . $validated['company_name'] . '"';
            }
            if (!empty($validated['phone'])) {
                $replacements['COURIERS_PLEASE_DISPATCH_PHONE'] = '"' . $validated['phone'] . '"';
            }
            if (!empty($validated['email'])) {
                $replacements['COURIERS_PLEASE_DISPATCH_EMAIL'] = '"' . $validated['email'] . '"';
            }
            if (!empty($validated['address1'])) {
                $replacements['COURIERS_PLEASE_DISPATCH_ADDRESS1'] = '"' . $validated['address1'] . '"';
            }

            foreach ($replacements as $key => $val) {
                if (preg_match("/^{$key}=.*/m", $envContent)) {
                    $envContent = preg_replace("/^{$key}=.*/m", "{$key}={$val}", $envContent);
                } else {
                    $envContent .= "\n{$key}={$val}";
                }
            }

            file_put_contents($envPath, $envContent);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'CouriersPlease dispatch origin updated successfully.',
            'data' => [
                'suburb' => $validated['suburb'],
                'postcode' => $validated['postcode'],
                'state' => strtoupper($validated['state'] ?? 'NSW'),
            ],
        ]);
    }

    /**
     * List orders eligible for shipping and shipments.
     * Includes ready-to-ship paid orders, existing shipments, and tracking status.
     */
    public function orders(Request $request): JsonResponse
    {
        $statusFilter = $request->query('status', 'all'); // 'all', 'ready_to_ship', 'shipped'
        $search = $request->query('search', '');

        $query = Order::with(['items.product', 'user', 'shipments' => function ($q) {
            $q->latest();
        }]);

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('tracking_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        if ($statusFilter === 'ready_to_ship') {
            $query->where(function ($q) {
                $q->where('payment_status', 'paid')
                  ->whereNull('tracking_number');
            });
        } elseif ($statusFilter === 'shipped') {
            $query->whereNotNull('tracking_number');
        }

        $orders = $query->orderByDesc('created_at')->paginate(20);

        return response()->json([
            'status' => 'success',
            'data' => $orders->items(),
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
            ],
            'carrier_config' => $this->couriersPleaseService->getConfigStatus(),
        ]);
    }

    /**
     * Create a shipment with CouriersPlease for an eligible order.
     * Idempotent: returns existing shipment if already booked.
     */
    public function createShipment(Request $request, string $orderId): JsonResponse
    {
        $order = Order::with(['items.product', 'user', 'shipments'])->findOrFail($orderId);

        // Security / Safety check: Ensure order is paid before generating live carrier shipments
        if ($order->payment_status->value !== 'paid' && $request->input('force') !== true) {
            return response()->json([
                'status' => 'error',
                'message' => 'Postage and shipment generation is restricted to paid orders.',
            ], 422);
        }

        $options = [
            'rate_card_id' => $request->input('rate_card_id'),
            'is_signature_required' => $request->boolean('is_signature_required', false),
            'is_atl' => $request->boolean('is_atl', false),
            'force_new' => $request->boolean('force_new', false),
            'items' => $request->input('items', []),
        ];

        try {
            $shipment = $this->couriersPleaseService->createShipment($order, $options);

            return response()->json([
                'status' => 'success',
                'message' => 'Shipment successfully booked with CouriersPlease.',
                'data' => [
                    'shipment' => $shipment,
                    'order' => $order->fresh(['shipments']),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Admin shipping creation failed', [
                'order_id' => $orderId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Download or stream the shipping label PDF for a consignment.
     */
    public function downloadLabel(string $consignmentNumber)
    {
        try {
            $label = $this->couriersPleaseService->getShipmentLabel($consignmentNumber);

            return response($label['binary'], 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"CouriersPlease_Label_{$consignmentNumber}.pdf\"",
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Track parcel status and milestones.
     */
    public function trackParcel(string $consignmentNumber): JsonResponse
    {
        try {
            $tracking = $this->couriersPleaseService->locateParcel($consignmentNumber);

            return response()->json([
                'status' => 'success',
                'data' => $tracking,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Customer order tracking endpoint.
     */
    public function customerTracking(string $orderId): JsonResponse
    {
        $order = Order::with('latestShipment')->findOrFail($orderId);

        if (empty($order->tracking_number)) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'order_number' => $order->order_number,
                    'carrier' => $order->shipping_carrier ?? 'CouriersPlease',
                    'tracking_number' => null,
                    'status' => 'Processing order in production',
                    'events' => [],
                ],
            ]);
        }

        try {
            $tracking = $this->couriersPleaseService->locateParcel($order->tracking_number);

            return response()->json([
                'status' => 'success',
                'data' => array_merge($tracking, [
                    'order_number' => $order->order_number,
                    'carrier' => $order->shipping_carrier,
                ]),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'order_number' => $order->order_number,
                    'carrier' => $order->shipping_carrier,
                    'tracking_number' => $order->tracking_number,
                    'status' => 'Shipped - Awaiting Courier Scan',
                    'events' => [],
                ],
            ]);
        }
    }

    /**
     * Delivery Choices (optional behind configuration).
     */
    public function deliveryChoices(Request $request): JsonResponse
    {
        $postcode = (string) $request->query('postcode', '');
        if (empty($postcode)) {
            return response()->json(['status' => 'error', 'message' => 'Postcode is required.'], 422);
        }

        $options = $this->couriersPleaseService->getDeliveryChoices($postcode);

        return response()->json([
            'status' => 'success',
            'data' => $options,
        ]);
    }

    /**
     * Book Pickup (optional behind configuration).
     */
    public function bookPickup(Request $request): JsonResponse
    {
        try {
            $result = $this->couriersPleaseService->bookPickup($request->all());

            return response()->json([
                'status' => 'success',
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Search CouriersPlease serviceable Australian suburbs and postcodes.
     * Calls GET /v1/locations?suburbOrPostcode=...
     */
    public function locations(Request $request): JsonResponse
    {
        $query = (string) $request->query('query', $request->query('suburbOrPostcode', ''));
        $results = $this->couriersPleaseService->searchLocations($query);

        return response()->json([
            'status' => 'success',
            'data' => $results,
        ]);
    }
}
