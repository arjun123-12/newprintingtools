<?php

namespace App\Http\Controllers\Api\V1\Pricing;

use App\Http\Controllers\Controller;
use App\Services\Pricing\PricingCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    public function __construct(
        protected PricingCalculatorService $pricingCalculatorService
    ) {}

    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|string',
            'quantity' => 'required|integer|min:1',
            'selected_options' => 'required|array',
            'custom_dimensions' => 'nullable|array',
        ]);

        $result = $this->pricingCalculatorService->calculate($validated);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
