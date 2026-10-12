<?php

namespace App\Services\Shipping\Carriers;

use App\Models\Order;
use App\Models\Shipment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class CouriersPleaseService
{
    protected string $environment;
    protected string $baseUrl;
    protected string $accountNumber;
    protected string $apiKey;
    protected array $dispatch;
    protected bool $enableDeliveryChoices;
    protected bool $enablePickups;
    protected string $defaultRateCard;
    protected int $timeout;
    protected bool $sslVerify;

    public function __construct()
    {
        $this->environment = config('couriersplease.environment', 'sandbox');
        $baseUrls = config('couriersplease.base_urls', [
            'sandbox' => 'https://api-test.couriersplease.com.au',
            'production' => 'https://api.couriersplease.com.au',
        ]);
        $this->baseUrl = $baseUrls[$this->environment] ?? $baseUrls['sandbox'];
        $this->accountNumber = (string) config('couriersplease.account_number', '');
        $this->apiKey = (string) config('couriersplease.api_key', '');
        $this->dispatch = (array) config('couriersplease.dispatch', []);
        $this->enableDeliveryChoices = (bool) config('couriersplease.enable_delivery_choices', false);
        $this->enablePickups = (bool) config('couriersplease.enable_pickups', false);
        $this->defaultRateCard = (string) config('couriersplease.default_rate_card', 'L55');
        $this->timeout = (int) config('couriersplease.timeout_seconds', 15);
        $this->sslVerify = (bool) config('couriersplease.ssl_verify', false);
    }

    /**
     * Build standard HTTP client configured with basic auth and SSL settings.
     */
    protected function client()
    {
        return Http::withBasicAuth($this->accountNumber, $this->apiKey)
            ->timeout($this->timeout)
            ->withOptions(['verify' => $this->sslVerify]);
    }

    /**
     * Determine whether CouriersPlease account credentials are set.
     */
    public function isConfigured(): bool
    {
        return !empty(trim($this->accountNumber)) && !empty(trim($this->apiKey));
    }

    /**
     * Determine whether sender dispatch suburb and postcode are set.
     * Note: "Do not assume Sydney 2000; make dispatch suburb/postcode configurable and require it before quoting."
     */
    public function isDispatchOriginConfigured(): bool
    {
        $suburb = trim((string) ($this->dispatch['suburb'] ?? ''));
        $postcode = trim((string) ($this->dispatch['postcode'] ?? ''));

        return !empty($suburb) && !empty($postcode);
    }

    /**
     * Get non-sensitive configuration status for frontend and health checks.
     */
    public function getConfigStatus(): array
    {
        return [
            'carrier' => 'CouriersPlease',
            'environment' => $this->environment,
            'is_sandbox' => $this->environment === 'sandbox',
            'has_credentials' => $this->isConfigured(),
            'account_number_masked' => !empty($this->accountNumber) ? substr($this->accountNumber, 0, 3) . '****' : null,
            'dispatch_origin_configured' => $this->isDispatchOriginConfigured(),
            'dispatch_suburb' => $this->dispatch['suburb'] ?? null,
            'dispatch_postcode' => $this->dispatch['postcode'] ?? null,
            'dispatch_state' => $this->dispatch['state'] ?? null,
            'dispatch_name' => $this->dispatch['name'] ?? null,
            'dispatch_company' => $this->dispatch['company_name'] ?? null,
            'enable_delivery_choices' => $this->enableDeliveryChoices,
            'enable_pickups' => $this->enablePickups,
            'default_rate_card' => $this->defaultRateCard,
        ];
    }

    /**
     * Request a domestic shipping quote from CouriersPlease.
     * Enforces that dispatch origin is configured; do NOT assume Sydney 2000.
     *
     * @param string $toSuburb Destination suburb
     * @param string $toPostcode Destination postcode
     * @param array $items Parcel items [{length, width, height, physicalWeight, quantity}]
     * @return array Standardized rate quotes
     */
    public function getDomesticQuote(string $toSuburb, string $toPostcode, array $items = []): array
    {
        if (!$this->isDispatchOriginConfigured()) {
            throw new RuntimeException(
                'CouriersPlease dispatch origin is not configured. Please configure COURIERS_PLEASE_DISPATCH_SUBURB and COURIERS_PLEASE_DISPATCH_POSTCODE before quoting.'
            );
        }

        if (!$this->isConfigured()) {
            throw new RuntimeException(
                'CouriersPlease API credentials are not configured. Please set COURIERS_PLEASE_ACCOUNT_NUMBER and COURIERS_PLEASE_API_KEY.'
            );
        }

        $fromSuburb = trim((string) ($this->dispatch['suburb'] ?? ''));
        $fromPostcode = (int) ($this->dispatch['postcode'] ?? 0);

        // Normalize parcels or fallback to standard parcel
        $formattedItems = $this->normalizeQuoteItems($items);

        $payload = [
            'fromSuburb' => $fromSuburb,
            'fromPostcode' => $fromPostcode,
            'toSuburb' => trim($toSuburb),
            'toPostcode' => (int) trim($toPostcode),
            'items' => $formattedItems,
        ];

        try {
            $response = $this->client()
                ->acceptJson()
                ->post("{$this->baseUrl}/v1/domestic/quote", $payload);

            if ($response->failed()) {
                $errorBody = $response->json() ?? [];
                $errMsg = $errorBody['msg'] ?? $errorBody['message'] ?? $response->body();
                Log::warning('CouriersPlease Quote API returned error status', [
                    'status' => $response->status(),
                    'error' => $errMsg,
                    'destination' => "{$toSuburb} {$toPostcode}",
                ]);
                throw new RuntimeException("CouriersPlease Quote error ({$response->status()}): {$errMsg}");
            }

            $body = $response->json();
            $ratesData = $body['data'] ?? $body;

            return $this->formatQuoteResponse($ratesData);
        } catch (\Exception $e) {
            Log::error('CouriersPlease Quote API exception: ' . $e->getMessage(), [
                'toSuburb' => $toSuburb,
                'toPostcode' => $toPostcode,
            ]);
            throw $e;
        }
    }

    /**
     * Create shipment and book consignment on CouriersPlease.
     * Idempotent: if order already has an active CouriersPlease shipment, return existing.
     */
    public function createShipment(Order $order, array $options = []): Shipment
    {
        // 1. Idempotency check: return existing active shipment if already generated
        $existingShipment = $order->shipments()
            ->where('carrier', 'CouriersPlease')
            ->whereNotNull('consignment_code')
            ->first();

        if ($existingShipment && empty($options['force_new'])) {
            return $existingShipment;
        }

        if (!$this->isDispatchOriginConfigured()) {
            throw new RuntimeException(
                'CouriersPlease dispatch origin is not configured. Please configure COURIERS_PLEASE_DISPATCH_SUBURB and COURIERS_PLEASE_DISPATCH_POSTCODE before creating shipments.'
            );
        }

        if (!$this->isConfigured()) {
            throw new RuntimeException(
                'CouriersPlease API credentials are not configured. Please set COURIERS_PLEASE_ACCOUNT_NUMBER and COURIERS_PLEASE_API_KEY.'
            );
        }

        // 2. Build pickup (origin sender) info from configuration
        $pickup = $this->buildPickupPayload();

        // 3. Build destination (recipient) info from Order shipping_address
        $destination = $this->buildDestinationPayload($order);

        // 4. Build contact info (same as sender dispatch contact)
        $contact = $this->buildContactPayload();

        // 5. Build items parcel array
        $items = $this->buildShipmentItems($order, $options['items'] ?? []);

        // 6. Rate card ID
        $rateCardId = $options['rate_card_id'] ?? $this->defaultRateCard;

        $referenceNumber = (string) ($order->order_number ?? $order->id);

        $payload = array_merge([
            'items' => $items,
            'specialInstruction' => substr(trim((string) ($order->customer_notes ?? 'Handle with care - Print goods')), 0, 140),
            'termsAccepted' => true,
            'dangerousGoods' => false,
            'rateCardId' => $rateCardId,
            'isSignatureRequired' => (bool) ($options['is_signature_required'] ?? false),
            'referenceNumber' => substr($referenceNumber, 0, 40),
            'isATL' => (bool) ($options['is_atl'] ?? false), // Authority To Leave
            'readyDateTime' => $options['ready_date_time'] ?? null,
        ], $pickup, $destination, $contact);

        $response = $this->client()
            ->acceptJson()
            ->post("{$this->baseUrl}/v1/domestic/shipment/create", $payload);

        $responseBody = $response->json();

        if ($response->failed() || empty($responseBody['data']['consignmentCode'])) {
            $errMsg = $responseBody['msg'] ?? $responseBody['message'] ?? $response->body();
            Log::error('CouriersPlease Shipment Create failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'response' => $responseBody,
            ]);
            throw new RuntimeException("CouriersPlease Shipment Creation failed: {$errMsg}");
        }

        $data = $responseBody['data'];
        $consignmentCode = (string) $data['consignmentCode'];
        $jobNumber = $data['jobNumber'] ?? null;

        // 7. Persist Shipment record safely
        $shipment = Shipment::create([
            'order_id' => $order->id,
            'carrier' => 'CouriersPlease',
            'consignment_code' => $consignmentCode,
            'reference_number' => $referenceNumber,
            'job_number' => $jobNumber,
            'rate_card_id' => $rateCardId,
            'status' => 'created',
            'request_payload' => $payload,
            'response_payload' => $responseBody,
            'shipped_at' => now(),
        ]);

        // 8. Update Order carrier & tracking number
        $order->update([
            'shipping_carrier' => 'CouriersPlease',
            'tracking_number' => $consignmentCode,
        ]);

        return $shipment;
    }

    /**
     * Download or retrieve the label for a CouriersPlease consignment.
     * Calls GET /v1/domestic/shipment/label?consignmentNumber=...
     */
    public function getShipmentLabel(string $consignmentNumber): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('CouriersPlease API credentials are not configured.');
        }

        $url = "{$this->baseUrl}/v1/domestic/shipment/label";

        $response = $this->client()
            ->get($url, [
                'consignmentNumber' => $consignmentNumber,
            ]);

        if ($response->failed()) {
            $errorMsg = "Unable to retrieve label for consignment {$consignmentNumber}. Status: {$response->status()}";
            Log::error($errorMsg, ['body' => $response->body()]);
            throw new RuntimeException($errorMsg);
        }

        $contentType = $response->header('Content-Type') ?? 'application/pdf';
        $json = $response->json();
        $binary = null;

        // CouriersPlease returns JSON with data.label containing base64 PDF
        if (is_array($json) && !empty($json['data']['label'])) {
            $binary = base64_decode(preg_replace('/\s+/', '', (string) $json['data']['label']));
        } elseif (is_string($response->body()) && str_starts_with(trim($response->body()), '%PDF')) {
            $binary = $response->body();
        } else {
            $decoded = base64_decode(trim($response->body()), true);
            $binary = ($decoded && str_starts_with($decoded, '%PDF')) ? $decoded : $response->body();
        }

        // Save label PDF locally to public storage for fast re-downloading
        $fileName = "labels/{$consignmentNumber}.pdf";
        Storage::disk('public')->put($fileName, $binary);
        $publicUrl = Storage::disk('public')->url($fileName);

        // Update shipment record if exists
        Shipment::where('consignment_code', $consignmentNumber)->update([
            'label_url' => $publicUrl,
            'label_path' => $fileName,
        ]);

        return [
            'consignment_number' => $consignmentNumber,
            'content_type' => $contentType,
            'url' => $publicUrl,
            'binary' => $binary,
        ];
    }

    /**
     * Locate / track parcel milestones.
     * Calls GET /v2/domestic/locateParcel?trackingCode=...
     */
    public function locateParcel(string $trackingCode): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('CouriersPlease API credentials are not configured.');
        }

        $url = "{$this->baseUrl}/v2/domestic/locateParcel";

        $response = $this->client()
            ->acceptJson()
            ->get($url, [
                'trackingCode' => $trackingCode,
            ]);

        if ($response->failed()) {
            $errorMsg = "Unable to locate parcel for tracking code {$trackingCode}. Status: {$response->status()}";
            Log::warning($errorMsg, ['body' => $response->body()]);
            throw new RuntimeException($errorMsg);
        }

        $json = $response->json();
        $consignmentInfo = $json['data']['consignmentInfo'][0] ?? null;

        if (!$consignmentInfo) {
            return [
                'tracking_code' => $trackingCode,
                'status' => 'Pending Tracking Update',
                'events' => [],
                'eta' => null,
                'pod' => null,
                'raw' => $json,
            ];
        }

        $events = [];
        $itemsCoupons = $consignmentInfo['itemsCoupons'] ?? [];
        foreach ($itemsCoupons as $coupon) {
            $trackingList = $coupon['trackingInfo'] ?? [];
            foreach ($trackingList as $evt) {
                $events[] = [
                    'date' => $evt['date'] ?? '',
                    'time' => $evt['time'] ?? '',
                    'action' => $evt['action'] ?? '',
                    'contractor' => $evt['contractor'] ?? '',
                    'location' => $evt['contractor'] ?? '',
                ];
            }
        }

        $statusText = $consignmentInfo['status'] ?? 'In Transit';

        // Update shipment tracking cache if found
        Shipment::where('consignment_code', $trackingCode)->update([
            'tracking_data' => [
                'status' => $statusText,
                'eta' => $consignmentInfo['deliveryETA'] ?? null,
                'pod' => $consignmentInfo['POD'] ?? null,
                'delivered_at' => $consignmentInfo['deliveredAt'] ?? null,
                'events' => $events,
            ],
            'status' => $this->mapCouriersPleaseStatus($statusText),
        ]);

        return [
            'tracking_code' => $trackingCode,
            'status' => $statusText,
            'eta' => $consignmentInfo['deliveryETA'] ?? null,
            'pod' => $consignmentInfo['POD'] ?? null,
            'delivered_at' => $consignmentInfo['deliveredAt'] ?? null,
            'dead_weight' => $consignmentInfo['deadWeight'] ?? null,
            'events' => $events,
            'raw' => $json,
        ];
    }

    /**
     * Map CP status string to internal shipment status.
     */
    protected function mapCouriersPleaseStatus(string $statusText): string
    {
        $lower = strtolower($statusText);
        if (str_contains($lower, 'delivered')) {
            return 'delivered';
        }
        if (str_contains($lower, 'on-board') || str_contains($lower, 'out for delivery')) {
            return 'out_for_delivery';
        }
        if (str_contains($lower, 'transit') || str_contains($lower, 'depot')) {
            return 'in_transit';
        }
        return 'created';
    }

    /**
     * Delivery Choices API (optional behind feature flag).
     */
    public function getDeliveryChoices(string $postcode): array
    {
        if (!$this->enableDeliveryChoices) {
            return [];
        }

        $url = "{$this->baseUrl}/v2/domestic/deliveryOptions";
        $response = $this->client()
            ->get($url, [
                'postcode' => $postcode,
                'countryCode' => 'AU',
            ]);

        return $response->json() ?? [];
    }

    /**
     * Book Pickup API (optional behind feature flag).
     */
    public function bookPickup(array $data): array
    {
        if (!$this->enablePickups) {
            throw new RuntimeException('CouriersPlease pickup booking is currently disabled in configuration.');
        }

        $url = "{$this->baseUrl}/v2/domestic/bookPickup";
        $response = $this->client()
            ->post($url, $data);

        return $response->json() ?? [];
    }

    /**
     * Search CouriersPlease serviceable Australian suburbs and postcodes.
     * Calls GET /v1/locations?suburbOrPostcode=...
     *
     * @param string $suburbOrPostcode Minimum 3 characters (e.g. "Syd" or "2000")
     * @return array List of valid suburbs, postcodes, states, and pickup flags
     */
    public function searchLocations(string $suburbOrPostcode): array
    {
        if (!$this->isConfigured()) {
            return [];
        }

        $query = trim($suburbOrPostcode);
        if (strlen($query) < 3) {
            return [];
        }

        $url = "{$this->baseUrl}/v1/locations";
        $response = $this->client()
            ->acceptJson()
            ->get($url, [
                'suburbOrPostcode' => $query,
            ]);

        if ($response->failed()) {
            return [];
        }

        $json = $response->json();
        return $json['data'] ?? [];
    }

    /**
     * Format rates returned by CP Quote API into clean standardized output.
     */
    protected function formatQuoteResponse($ratesData): array
    {
        if (!is_array($ratesData)) {
            return [];
        }

        // If single object returned rather than list
        if (isset($ratesData['RateCardCode'])) {
            $ratesData = [$ratesData];
        }

        $results = [];
        foreach ($ratesData as $rate) {
            if (!is_array($rate) || empty($rate['RateCardCode'])) {
                continue;
            }

            $freight = (float) ($rate['CalculatedFreightCharge'] ?? 0);
            $fuel = (float) ($rate['CalculatedFuelCharge'] ?? 0);
            $subtotal = $freight + $fuel;
            $gst = round($subtotal * 0.10, 2);
            $totalIncGst = round($subtotal + $gst, 2);

            $eta = $rate['ETA'] ?? '2-4 Business Days';
            $etaDays = is_numeric($eta) ? "{$eta} Business Days" : (string) $eta;

            $results[] = [
                'id' => 'cp_' . strtolower($rate['RateCardCode']),
                'carrier' => 'CouriersPlease',
                'name' => 'CouriersPlease - ' . ($rate['RateCardDescription'] ?? $rate['RateCardCode']),
                'rate_card_code' => $rate['RateCardCode'],
                'rate_card_description' => $rate['RateCardDescription'] ?? 'Domestic Express Parcel',
                'freight_charge' => $freight,
                'fuel_charge' => $fuel,
                'gst_charge' => $gst,
                'price_inc_gst' => $totalIncGst,
                'original_price' => $totalIncGst,
                'estimated_days' => $etaDays,
                'cutoff_time' => $rate['PickupCutOffTime'] ?? '3:59 PM',
                'chargeable_weight' => $rate['Weight'] ?? null,
            ];
        }

        return $results;
    }

    /**
     * Normalize parcels array according to CP Quote V1 specifications.
     * Dimensions MUST be integers (whole numbers 1 - 180).
     */
    protected function normalizeQuoteItems(array $items): array
    {
        if (empty($items)) {
            return [
                [
                    'quantity' => '1',
                    'length' => '30',
                    'width' => '22',
                    'height' => '10',
                    'physicalWeight' => '1.5',
                ],
            ];
        }

        $formatted = [];
        foreach ($items as $item) {
            $qty = max(1, min(10, (int) ($item['quantity'] ?? 1)));
            $length = max(1, min(180, (int) round((float) ($item['length'] ?? 30))));
            $width = max(1, min(180, (int) round((float) ($item['width'] ?? 22))));
            $height = max(1, min(180, (int) round((float) ($item['height'] ?? 10))));
            $weight = max(0.01, min(25.0, round((float) ($item['physicalWeight'] ?? $item['weight'] ?? 1.5), 2)));

            $formatted[] = [
                'quantity' => (string) $qty,
                'length' => (string) $length,
                'width' => (string) $width,
                'height' => (string) $height,
                'physicalWeight' => (string) $weight,
            ];
        }

        return array_slice($formatted, 0, 10);
    }

    protected function buildPickupPayload(): array
    {
        $nameParts = explode(' ', trim((string) ($this->dispatch['name'] ?? 'Dispatch Team')), 2);
        $firstName = $nameParts[0] ?? 'Dispatch';
        $lastName = $nameParts[1] ?? 'Manager';

        return [
            'pickupFirstName' => substr($firstName, 0, 50),
            'pickupLastName' => substr($lastName, 0, 50),
            'pickupCompanyName' => substr((string) ($this->dispatch['company_name'] ?? 'Erry Imprints'), 0, 50),
            'pickupEmail' => (string) ($this->dispatch['email'] ?? 'orders@erryimprints.com.au'),
            'pickupAddress1' => substr((string) ($this->dispatch['address1'] ?? '123 Printing Way'), 0, 100),
            'pickupAddress2' => !empty($this->dispatch['address2']) ? substr((string) $this->dispatch['address2'], 0, 100) : null,
            'pickupSuburb' => substr((string) ($this->dispatch['suburb'] ?? ''), 0, 100),
            'pickupState' => substr(strtoupper((string) ($this->dispatch['state'] ?? 'NSW')), 0, 3),
            'pickupPostcode' => (int) ($this->dispatch['postcode'] ?? 0),
            'pickupPhone' => preg_replace('/[^0-9+ ]/', '', (string) ($this->dispatch['phone'] ?? '0400000000')),
            'pickupIsBusiness' => (bool) ($this->dispatch['is_business'] ?? true),
        ];
    }

    protected function buildContactPayload(): array
    {
        $nameParts = explode(' ', trim((string) ($this->dispatch['name'] ?? 'Dispatch Team')), 2);
        $firstName = $nameParts[0] ?? 'Dispatch';
        $lastName = $nameParts[1] ?? 'Manager';

        return [
            'contactFirstName' => substr($firstName, 0, 50),
            'contactLastName' => substr($lastName, 0, 50),
            'contactCompanyName' => substr((string) ($this->dispatch['company_name'] ?? 'Erry Imprints'), 0, 50),
            'contactEmail' => (string) ($this->dispatch['email'] ?? 'orders@erryimprints.com.au'),
            'contactAddress1' => substr((string) ($this->dispatch['address1'] ?? '123 Printing Way'), 0, 100),
            'contactAddress2' => !empty($this->dispatch['address2']) ? substr((string) $this->dispatch['address2'], 0, 100) : null,
            'contactSuburb' => substr((string) ($this->dispatch['suburb'] ?? ''), 0, 100),
            'contactState' => substr(strtoupper((string) ($this->dispatch['state'] ?? 'NSW')), 0, 3),
            'contactPostcode' => (int) ($this->dispatch['postcode'] ?? 0),
            'contactPhone' => preg_replace('/[^0-9+ ]/', '', (string) ($this->dispatch['phone'] ?? '0400000000')),
            'contactIsBusiness' => (bool) ($this->dispatch['is_business'] ?? true),
        ];
    }

    protected function buildDestinationPayload(Order $order): array
    {
        $address = (array) ($order->shipping_address ?? []);
        $fullName = trim((string) ($address['name'] ?? $order->user?->name ?? 'Valued Customer'));
        $nameParts = explode(' ', $fullName, 2);
        $firstName = $nameParts[0] ?? 'Valued';
        $lastName = $nameParts[1] ?? 'Customer';

        $company = !empty($address['company']) ? substr((string) $address['company'], 0, 50) : null;
        $isBusiness = !empty($company);

        $line1 = substr((string) ($address['address_line_1'] ?? $address['street'] ?? '1 Delivery Road'), 0, 100);
        $line2 = !empty($address['address_line_2']) ? substr((string) $address['address_line_2'], 0, 100) : null;
        $suburb = substr((string) ($address['suburb'] ?? $address['city'] ?? ''), 0, 100);
        $state = substr(strtoupper((string) ($address['state'] ?? 'NSW')), 0, 3);
        $postcode = (int) ($address['postcode'] ?? 0);
        $phone = preg_replace('/[^0-9+ ]/', '', (string) ($address['phone'] ?? $order->user?->phone ?? '0400000000'));
        $email = (string) ($order->user?->email ?? 'customer@example.com');

        return [
            'destinationFirstName' => substr($firstName, 0, 50),
            'destinationLastName' => substr($lastName, 0, 50),
            'destinationCompanyName' => $company,
            'destinationEmail' => $email,
            'destinationAddress1' => $line1,
            'destinationAddress2' => $line2,
            'destinationSuburb' => $suburb,
            'destinationState' => $state,
            'destinationPostcode' => $postcode,
            'destinationPhone' => !empty($phone) ? $phone : '0400000000',
            'destinationIsBusiness' => $isBusiness,
        ];
    }

    protected function buildShipmentItems(Order $order, array $customItems = []): array
    {
        if (!empty($customItems)) {
            $formatted = [];
            foreach ($customItems as $item) {
                $formatted[] = [
                    'length' => max(1, min(180, (int) round((float) ($item['length'] ?? 30)))),
                    'width' => max(1, min(180, (int) round((float) ($item['width'] ?? 22)))),
                    'height' => max(1, min(180, (int) round((float) ($item['height'] ?? 10)))),
                    'physicalWeight' => max(0.01, min(25.0, round((float) ($item['physicalWeight'] ?? $item['weight'] ?? 1.5), 2))),
                    'quantity' => max(1, min(10, (int) ($item['quantity'] ?? 1))),
                ];
            }
            return array_slice($formatted, 0, 10);
        }

        // Estimate parcel specs based on total order items count and product weight
        $itemCount = $order->items()->count();
        $totalWeight = 0.5;

        foreach ($order->items as $orderItem) {
            $qty = $orderItem->quantity ?? 1;
            $productShipping = $orderItem->product?->shipping;
            $weightPerUnit = $productShipping?->weight_kg ?? 0.05;
            $totalWeight += ($weightPerUnit * $qty);
        }

        $totalWeight = max(0.2, min(25.0, round($totalWeight, 2)));

        return [
            [
                'length' => 30,
                'width' => 22,
                'height' => 10,
                'physicalWeight' => $totalWeight,
                'quantity' => 1,
            ],
        ];
    }
}
