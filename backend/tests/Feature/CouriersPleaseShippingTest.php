<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Shipping\Carriers\CouriersPleaseService;
use App\Services\Shipping\ShippingCalculatorService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CouriersPleaseShippingTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /**
     * Test that CouriersPlease enforces configurable dispatch origin and refuses to quote if missing.
     * (Do not assume Sydney 2000).
     */
    public function test_couriers_please_requires_configured_dispatch_origin_before_quoting()
    {
        Config::set('couriersplease.dispatch.suburb', null);
        Config::set('couriersplease.dispatch.postcode', null);

        $service = new CouriersPleaseService();

        $this->assertFalse($service->isDispatchOriginConfigured());

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('CouriersPlease dispatch origin is not configured');

        $service->getDomesticQuote('Brisbane', '4000');
    }

    /**
     * Test quoting with configured dispatch origin and credentials.
     */
    public function test_couriers_please_quote_calculates_freight_fuel_and_gst()
    {
        Config::set('couriersplease.environment', 'sandbox');
        Config::set('couriersplease.account_number', 'WD00000006');
        Config::set('couriersplease.api_key', 'cc995cb9-38b9-4b40-995a-01f3a427a579');
        Config::set('couriersplease.dispatch.suburb', 'Manly');
        Config::set('couriersplease.dispatch.postcode', '2095');
        Config::set('couriersplease.dispatch.state', 'NSW');

        Http::fake([
            'https://api-test.couriersplease.com.au/v1/domestic/quote' => Http::response([
                'responseCode' => 'SUCCESS',
                'msg' => '',
                'data' => [
                    [
                        'RateCardCode' => 'L55',
                        'RateCardDescription' => 'CouriersPlease Domestic Express',
                        'CalculatedFreightCharge' => 20.00,
                        'CalculatedFuelCharge' => 2.00,
                        'ETA' => '2-3',
                        'PickupCutOffTime' => '3:59 PM',
                        'Weight' => 1.5,
                    ]
                ]
            ], 200),
        ]);

        $service = new CouriersPleaseService();
        $this->assertTrue($service->isDispatchOriginConfigured());
        $this->assertTrue($service->isConfigured());

        $rates = $service->getDomesticQuote('Ball Bay', '4741');

        $this->assertCount(1, $rates);
        $rate = $rates[0];
        $this->assertEquals('cp_l55', $rate['id']);
        $this->assertEquals(20.00, $rate['freight_charge']);
        $this->assertEquals(2.00, $rate['fuel_charge']);
        // Subtotal = 22.00, GST 10% = 2.20, Total = 24.20
        $this->assertEquals(2.20, $rate['gst_charge']);
        $this->assertEquals(24.20, $rate['price_inc_gst']);
    }

    /**
     * Test shipment creation idempotency (does not duplicate consignment if already exists).
     * Isolated using DatabaseTransactions and a unique order number per test run.
     */
    public function test_shipment_creation_is_idempotent()
    {
        $dbName = DB::connection()->getDatabaseName();
        $this->assertNotEmpty($dbName);

        Config::set('couriersplease.account_number', 'WD00000006');
        Config::set('couriersplease.api_key', 'cc995cb9-38b9-4b40-995a-01f3a427a579');
        Config::set('couriersplease.dispatch.suburb', 'Manly');
        Config::set('couriersplease.dispatch.postcode', '2095');

        $uniqueKey = strtoupper(uniqid());
        $orderNumber = 'ORD-CP-TEST-' . $uniqueKey;
        $consignmentCode = 'CPWL' . $uniqueKey;

        $user = User::factory()->create([
            'email' => 'cp_test_user_' . uniqid() . '@example.com',
        ]);

        $order = Order::create([
            'order_number' => $orderNumber,
            'user_id' => $user->id,
            'status' => OrderStatus::PENDING_PAYMENT,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 12.50,
            'total_inc_gst' => 112.50,
            'currency' => 'AUD',
            'shipping_address' => [
                'name' => 'John Customer',
                'address_line_1' => '10 Queen St',
                'suburb' => 'Melbourne',
                'state' => 'VIC',
                'postcode' => '3000',
                'phone' => '0412345678',
            ],
            'billing_address' => [],
        ]);

        // Pre-existing shipment
        $existingShipment = Shipment::create([
            'order_id' => $order->id,
            'carrier' => 'CouriersPlease',
            'consignment_code' => $consignmentCode,
            'reference_number' => $orderNumber,
            'status' => 'created',
        ]);

        $service = new CouriersPleaseService();

        // Should return existing shipment immediately without making an HTTP request
        $result = $service->createShipment($order);

        $this->assertEquals($existingShipment->id, $result->id);
        $this->assertEquals($consignmentCode, $result->consignment_code);
    }

    /**
     * Test live tracking endpoint format.
     */
    public function test_locate_parcel_tracking()
    {
        Config::set('couriersplease.account_number', 'WD00000006');
        Config::set('couriersplease.api_key', 'cc995cb9-38b9-4b40-995a-01f3a427a579');

        Http::fake([
            'https://api-test.couriersplease.com.au/v2/domestic/locateParcel*' => Http::response([
                'responseCode' => 'SUCCESS',
                'msg' => '',
                'data' => [
                    'consignmentInfo' => [
                        [
                            'POD' => 'BEN',
                            'consignmentCode' => 'CPWREC999999999',
                            'deadWeight' => 'Declared 20 kg',
                            'deliveredAt' => '13 Jan 2026 10:46:35',
                            'deliveryETA' => '13 Jan 2026',
                            'itemsCoupons' => [
                                [
                                    'item' => 'CPWREC99999999901',
                                    'trackingInfo' => [
                                        [
                                            'action' => 'Your parcel is in transit from Melbourne to Sydney.',
                                            'contractor' => 'Depot 1',
                                            'date' => '12 Jan 2026',
                                            'time' => '11:10 am',
                                        ],
                                        [
                                            'action' => 'Delivered. Signed by BEN',
                                            'contractor' => 'Driver 54',
                                            'date' => '13 Jan 2026',
                                            'time' => '10:46 am',
                                        ]
                                    ]
                                ]
                            ],
                            'status' => 'delivered 2 of 2',
                        ]
                    ]
                ]
            ], 200),
        ]);

        $service = new CouriersPleaseService();
        $tracking = $service->locateParcel('CPWREC999999999');

        $this->assertEquals('CPWREC999999999', $tracking['tracking_code']);
        $this->assertEquals('delivered 2 of 2', $tracking['status']);
        $this->assertCount(2, $tracking['events']);
        $this->assertEquals('Your parcel is in transit from Melbourne to Sydney.', $tracking['events'][0]['action']);
    }

    /**
     * Test retrieving and decoding Base64 PDF shipping label.
     */
    public function test_get_shipment_label_decodes_base64_pdf()
    {
        Config::set('couriersplease.account_number', 'WD00000006');
        Config::set('couriersplease.api_key', 'cc995cb9-38b9-4b40-995a-01f3a427a579');

        $fakePdfContent = '%PDF-1.4 sample label binary content';
        $base64Label = base64_encode($fakePdfContent);

        Http::fake([
            'https://api-test.couriersplease.com.au/v1/domestic/shipment/label*' => Http::response([
                'responseCode' => 'SUCCESS',
                'msg' => '',
                'data' => [
                    'label' => $base64Label,
                ]
            ], 200),
        ]);

        $service = new CouriersPleaseService();
        $result = $service->getShipmentLabel('CPWREC999999999');

        $this->assertEquals('CPWREC999999999', $result['consignment_number']);
        $this->assertEquals($fakePdfContent, $result['binary']);
    }

    /**
     * Test Locations API searching Australian suburbs and postcodes.
     */
    public function test_search_locations_returns_valid_suburbs()
    {
        Config::set('couriersplease.account_number', 'WD00000006');
        Config::set('couriersplease.api_key', 'cc995cb9-38b9-4b40-995a-01f3a427a579');

        Http::fake([
            'https://api-test.couriersplease.com.au/v1/locations*' => Http::response([
                'responseCode' => 'SUCCESS',
                'msg' => '',
                'data' => [
                    [
                        'Postcode' => '2000',
                        'State' => 'NSW',
                        'Suburb' => 'BARANGAROO',
                        'SuburbDetails' => 'BARANGAROO NSW 2000',
                        'PickUpFlag' => 'Y',
                    ],
                    [
                        'Postcode' => '2000',
                        'State' => 'NSW',
                        'Suburb' => 'SYDNEY',
                        'SuburbDetails' => 'SYDNEY NSW 2000',
                        'PickUpFlag' => 'Y',
                    ]
                ]
            ], 200),
        ]);

        $service = new CouriersPleaseService();
        $locations = $service->searchLocations('2000');

        $this->assertCount(2, $locations);
        $this->assertEquals('BARANGAROO', $locations[0]['Suburb']);
        $this->assertEquals('2000', $locations[0]['Postcode']);
        $this->assertEquals('Y', $locations[0]['PickUpFlag']);
    }
}
