<?php

namespace App\Services\Shipping;

class ShippingCalculatorService
{
    /**
     * Calculate n shipping rates based on postcode, weight, and carrier
     */
    public function calculateRates(string $postcode, string $state, float $totalWeightKg = 1.0): array
    {
        return [
            [
                'id' => 'auspost_standard',
                'name' => ' Post Standard',
                'price_inc_gst' => 12.50,
                'estimated_days' => '3-5 Business Days',
            ],
            [
                'id' => 'auspost_express',
                'name' => ' Post Express',
                'price_inc_gst' => 22.00,
                'estimated_days' => '1-2 Business Days',
            ],
            [
                'id' => 'startrack_premium',
                'name' => 'StarTrack Premium Overnight',
                'price_inc_gst' => 29.50,
                'estimated_days' => 'Next Business Day',
            ],
        ];
    }
}
