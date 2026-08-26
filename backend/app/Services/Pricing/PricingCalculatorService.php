<?php

namespace App\Services\Pricing;

class PricingCalculatorService
{
    const GST_RATE = 0.10;

    /**
     * Calculate dynamic pricing based on quantity breaks, selected dynamic options, and finishing fees
     */
    public function calculate(array $data): array
    {
        $productId = $data['product_id'] ?? null;
        $quantity = (int) ($data['quantity'] ?? 1);
        $selectedOptions = $data['selected_options'] ?? [];

        // Base unit price determination (placeholder for database pricing matrix lookup in Step 2)
        $baseUnitPriceExGst = 0.45;
        $setupFee = 25.00;

        // Apply volume tier discount
        if ($quantity >= 5000) {
            $baseUnitPriceExGst *= 0.65;
        } elseif ($quantity >= 2500) {
            $baseUnitPriceExGst *= 0.75;
        } elseif ($quantity >= 1000) {
            $baseUnitPriceExGst *= 0.85;
        } elseif ($quantity >= 500) {
            $baseUnitPriceExGst *= 0.92;
        }

        $subtotalExGst = ($baseUnitPriceExGst * $quantity) + $setupFee;
        $gstAmount = $subtotalExGst * self::GST_RATE;
        $totalIncGst = $subtotalExGst + $gstAmount;
        $unitPriceIncGst = $totalIncGst / $quantity;

        return [
            'product_id' => $productId,
            'quantity' => $quantity,
            'unit_price_ex_gst' => round($subtotalExGst / $quantity, 4),
            'unit_price_inc_gst' => round($unitPriceIncGst, 4),
            'subtotal_ex_gst' => round($subtotalExGst, 2),
            'gst_amount' => round($gstAmount, 2),
            'total_inc_gst' => round($totalIncGst, 2),
            'setup_fee' => round($setupFee, 2),
            'finishing_fees' => [],
            'currency' => 'AUD',
            'estimated_dispatch_date' => now()->addWeekdays(3)->toDateString(),
        ];
    }
}
