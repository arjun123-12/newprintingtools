<?php

namespace App\Http\Controllers\Api\V1\Admin\Products;
use App\Http\Requests\Admin\Products\UpdateProductRequest;
use App\Models\Product;
use App\Http\Controllers\Api\V1\Admin\Products\ProductService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Products\StoreProductRequest;
use App\Http\Resources\Admin\Products\ProductResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    protected ProductService $productService;

    public function __construct(ProductService $productService)
    {
        $this->productService = $productService;
    }

    /**
     * Store a newly created product in storage.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $validated = $request->validated();
        if ($request->has('print_layout')) {
            $validated['print_layout'] = $request->input('print_layout');
        }
        if ($request->has('folding_pricing')) {
            $validated['folding_pricing'] = $request->input('folding_pricing');
        }
        if ($request->has('printing_pricing')) {
            $validated['printing_pricing'] = $request->input('printing_pricing');
        }
        $sides = $validated['sides'] ?? [];
        $attributesData = $request->input('attributes', []);
        $pricingTiersData = $request->input('pricing_tiers', []);
        unset($validated['sides'], $validated['attributes'], $validated['pricing_tiers']);

        $product = $this->productService->createProduct($validated);
        
        if (!empty($sides)) {
            foreach ($sides as $sideData) {
                $printAreas = $sideData['print_areas'] ?? [];
                unset($sideData['print_areas']);
                
                $side = $product->sides()->create($sideData);
                
                if (!empty($printAreas)) {
                    $side->printAreas()->createMany($printAreas);
                }
            }
        }

        $this->syncProductRelations($product, $attributesData, $pricingTiersData);
        
        $product->load(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices']);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => new ProductResource($product)
        ], 201);
    }
    
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices']);

        if ($request->query('status') === 'archived' || $request->boolean('archived')) {
            $query->onlyTrashed()->orderByDesc('deleted_at');
        } else {
            $query->orderByDesc('created_at');
        }

        $products = $query->get();

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $product = Product::with(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices'])
            ->where('id', $id)
            ->orWhere('slug', $id)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => new ProductResource($product),
        ]);
    }

    public function update(
        UpdateProductRequest $request,
        string $id
    ): JsonResponse {
        $product = Product::findOrFail($id);

        $validated = $request->validated();
        if ($request->has('print_layout')) {
            $validated['print_layout'] = $request->input('print_layout');
        }
        if ($request->has('folding_pricing')) {
            $validated['folding_pricing'] = $request->input('folding_pricing');
        }
        if ($request->has('printing_pricing')) {
            $validated['printing_pricing'] = $request->input('printing_pricing');
        }
        
        $attributesData = $request->has('attributes') ? $request->input('attributes') : null;
        $pricingTiersData = $request->has('pricing_tiers') ? $request->input('pricing_tiers') : null;
        unset($validated['attributes'], $validated['pricing_tiers']);

        DB::transaction(function () use ($product, $validated, $attributesData, $pricingTiersData) {
            if (isset($validated['sides'])) {
                // Delete existing sides and let cascade drop print areas and template pages
                $product->sides()->delete();
                
                foreach ($validated['sides'] as $sideData) {
                    $printAreas = $sideData['print_areas'] ?? [];
                    unset($sideData['print_areas']);
                    
                    $side = $product->sides()->create($sideData);
                    
                    if (!empty($printAreas)) {
                        $side->printAreas()->createMany($printAreas);
                    }
                }
                unset($validated['sides']);
            }
            $product->update($validated);

            if ($attributesData !== null || $pricingTiersData !== null) {
                $this->syncProductRelations($product, $attributesData ?? [], $pricingTiersData ?? []);
            }
        });
        
        $product->load(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices']);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => new ProductResource($product),
        ]);
    }

    protected function syncProductRelations(Product $product, array $attributesData, array $pricingTiersData): void
    {
        // 1. Sync Dynamic Attributes & Values
        if (!empty($attributesData)) {
            $product->attributes()->delete();
            foreach ($attributesData as $sortOrder => $attrData) {
                $attr = $product->attributes()->create([
                    'name' => $attrData['name'] ?? 'Option',
                    'code' => $attrData['code'] ?? ('opt_' . $sortOrder),
                    'type' => in_array($attrData['type'] ?? '', ['select', 'radio', 'color', 'custom_dimensions']) ? $attrData['type'] : 'select',
                    'is_required' => (bool) ($attrData['is_required'] ?? false),
                    'sort_order' => (int) $sortOrder,
                ]);

                if (!empty($attrData['values']) && is_array($attrData['values'])) {
                    foreach ($attrData['values'] as $vSort => $vData) {
                        $priceModAmount = 0.0000;
                        if (isset($vData['price_modifier_amount']) && is_numeric($vData['price_modifier_amount'])) {
                            $priceModAmount = (float) $vData['price_modifier_amount'];
                        }

                        $desc = $vData['description'] ?? null;
                        if (!empty($vData['priceModifiers']) || isset($vData['is_active'])) {
                            $desc = json_encode([
                                'text' => $vData['description'] ?? '',
                                'is_active' => $vData['is_active'] ?? true,
                                'priceModifiers' => $vData['priceModifiers'] ?? [],
                            ]);
                        }

                        $attr->values()->create([
                            'label' => $vData['label'] ?? '',
                            'value' => $vData['value'] ?? '',
                            'description' => $desc,
                            'price_modifier_type' => in_array($vData['price_modifier_type'] ?? '', ['fixed', 'percentage', 'multiplier']) ? $vData['price_modifier_type'] : 'fixed',
                            'price_modifier_amount' => $priceModAmount,
                            'sort_order' => (int) $vSort,
                        ]);
                    }
                }
            }
        }

        // 2. Sync Quantity Pricing Matrices
        if (!empty($pricingTiersData)) {
            $product->pricingMatrices()->delete();
            foreach ($pricingTiersData as $tier) {
                $minQty = (int) ($tier['minQuantity'] ?? 0);
                $price = isset($tier['price']) ? (float) $tier['price'] : 0.00;
                if ($minQty > 0) {
                    $product->pricingMatrices()->create([
                        'quantity' => $minQty,
                        'unit_price_ex_gst' => $price,
                        'setup_fee' => 0.00,
                        'discount_percentage' => 0.00,
                    ]);
                }
            }
        }
    }

    /**
     * Get archived (soft-deleted) products.
     */
    public function archived(): JsonResponse
    {
        $products = Product::onlyTrashed()
            ->with(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices'])
            ->orderByDesc('deleted_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products),
        ]);
    }

    /**
     * Archive (soft-delete) a product.
     */
    public function destroy(string $id): JsonResponse
    {
        $product = Product::withTrashed()->find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        if ($product->trashed()) {
            return response()->json([
                'success' => false,
                'message' => 'Product is already archived.',
            ], 409);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product moved to archive successfully.',
        ]);
    }

    /**
     * Bulk archive (soft-delete) products.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $count = Product::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} product(s) moved to archive successfully.",
            'archived_count' => $count,
            'deleted_count' => $count,
        ]);
    }

    /**
     * Restore a soft-deleted product.
     */
    public function restore(string $id): JsonResponse
    {
        $product = Product::withTrashed()->find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        if (!$product->trashed()) {
            return response()->json([
                'success' => false,
                'message' => 'Product is not archived.',
            ], 409);
        }

        $product->restore();

        return response()->json([
            'success' => true,
            'message' => 'Product restored successfully.',
            'data' => new ProductResource($product->load(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices'])),
        ]);
    }

    /**
     * Bulk restore soft-deleted products.
     */
    public function bulkRestore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $count = Product::onlyTrashed()
            ->whereIn('id', $validated['ids'])
            ->restore();

        return response()->json([
            'success' => true,
            'message' => "{$count} product(s) restored successfully.",
            'restored_count' => $count,
        ]);
    }
}
