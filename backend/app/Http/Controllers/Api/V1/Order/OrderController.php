<?php

namespace App\Http\Controllers\Api\V1\Order;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [],
        ]);
    }

    public function show(string $orderNumber): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $orderNumber,
            ],
        ]);
    }
}
