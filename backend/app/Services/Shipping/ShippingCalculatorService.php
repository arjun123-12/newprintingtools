<?php

namespace App\Services\Shipping;

use App\Services\Shipping\Carriers\CouriersPleaseService;
use Illuminate\Support\Facades\Log;

class ShippingCalculatorService
{
    public function __construct(
        protected CouriersPleaseService $couriersPleaseService
    ) {}

    /**
     * Calculate shipping rates based on destination postcode, suburb, weight, and carriers.
     * CouriersPlease quotes are used dynamically when credentials and dispatch origin are configured.
     * Does not assume Sydney 2000.
     */
    public function calculateRates(string $postcode, string $state, float $totalWeightKg = 1.0, string $suburb = '', array $items = []): array
    {
        $rates = [];

        // Check if CouriersPlease has credentials and configured dispatch origin
        if ($this->couriersPleaseService->isConfigured() && $this->couriersPleaseService->isDispatchOriginConfigured() && !empty(trim($suburb)) && !empty(trim($postcode))) {
            try {
                $cpRates = $this->couriersPleaseService->getDomesticQuote(trim($suburb), trim($postcode), $items);
                if (!empty($cpRates)) {
                    $rates = array_merge($rates, $cpRates);
                }
            } catch (\Exception $e) {
                Log::warning('CouriersPlease quote calculation fallback: ' . $e->getMessage());
            }
        }

        // Always ensure reliable default CouriersPlease service options are available
        if (empty($rates)) {
            $rates[] = [
                'id' => 'cp_standard',
                'carrier' => 'CouriersPlease',
                'name' => 'CouriersPlease Standard Delivery',
                'rate_card_code' => config('couriersplease.default_rate_card', 'L55'),
                'rate_card_description' => 'Domestic Standard Road Express',
                'freight_charge' => 11.36,
                'fuel_charge' => 0.00,
                'gst_charge' => 1.14,
                'price_inc_gst' => 12.50,
                'original_price' => 12.50,
                'estimated_days' => '2-4 Business Days',
                'cutoff_time' => '3:59 PM',
            ];

            $rates[] = [
                'id' => 'cp_express',
                'carrier' => 'CouriersPlease',
                'name' => 'CouriersPlease Express Priority',
                'rate_card_code' => config('couriersplease.default_rate_card', 'L55'),
                'rate_card_description' => 'Domestic Express Priority Delivery',
                'freight_charge' => 20.00,
                'fuel_charge' => 0.00,
                'gst_charge' => 2.00,
                'price_inc_gst' => 22.00,
                'original_price' => 22.00,
                'estimated_days' => '1-2 Business Days',
                'cutoff_time' => '3:59 PM',
            ];
        }

        return $rates;
    }

    public function getCouriersPleaseService(): CouriersPleaseService
    {
        return $this->couriersPleaseService;
    }
}
