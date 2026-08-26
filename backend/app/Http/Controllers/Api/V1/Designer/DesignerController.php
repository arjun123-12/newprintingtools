<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignTemplate;
use Illuminate\Http\JsonResponse;

class DesignerController extends Controller
{
    public function templates(string $productId): JsonResponse
    {
        $templates = DesignTemplate::where('product_id', $productId)->where('is_active', true)->get();
        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }
}
