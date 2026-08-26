<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    public function metrics(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_orders' => 0,
                'revenue_aud' => 0.00,
                'pending_artwork_reviews' => 0,
                'in_production' => 0,
            ],
        ]);
    }
}
