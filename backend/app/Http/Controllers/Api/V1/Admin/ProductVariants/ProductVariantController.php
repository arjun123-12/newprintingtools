<?php

namespace App\Http\Controllers\Api\V1\Admin\ProductVariants;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use App\Http\Requests\Admin\ProductVariants\StoreProductVariantRequest;
use App\Http\Requests\Admin\ProductVariants\UpdateProductVariantRequest;
use App\Http\Controllers\Api\V1\Admin\ProductVariants\ProductVariantService;
use Illuminate\Http\JsonResponse;

class ProductVariantController extends Controller
{
    protected ProductVariantService $service;

    public function __construct(ProductVariantService $service)
    {
        $this->service = $service;
    }

    /**
     * List all variants for a given product.
     */
    public function index(string $productId): JsonResponse
    {
        $variants = ProductVariant::where('product_id', $productId)->get();
        return response()->json(['success' => true, 'data' => $variants]);
    }

    /**
     * Store a new variant for a product.
     */
    public function store(StoreProductVariantRequest $request, string $productId): JsonResponse
    {
        $variant = $this->service->createVariant($productId, $request->validated());
        return response()->json(['success' => true, 'data' => $variant], 201);
    }

    /**
     * Show a specific variant.
     */
    public function show(string $productId, string $id): JsonResponse
    {
        $variant = ProductVariant::where('product_id', $productId)->findOrFail($id);
        return response()->json(['success' => true, 'data' => $variant]);
    }

    /**
     * Update a variant.
     */
    public function update(UpdateProductVariantRequest $request, string $productId, string $id): JsonResponse
    {
        $variant = ProductVariant::where('product_id', $productId)->findOrFail($id);
        $updated = $this->service->updateVariant($variant, $request->validated());
        return response()->json(['success' => true, 'data' => $updated]);
    }

    /**
     * Delete a variant.
     */
    public function destroy(string $productId, string $id): JsonResponse
    {
        $variant = ProductVariant::where('product_id', $productId)->findOrFail($id);
        $this->service->deleteVariant($variant);
        return response()->json(['success' => true, 'message' => 'Variant deleted']);
    }
}
