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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        // Auto-derive base_price if not provided or 0
        if (!isset($validated['base_price']) || (float)$validated['base_price'] <= 0) {
            $validated['base_price'] = $this->deriveStartingPrice($validated, $pricingTiersData);
        }

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

        // Auto-derive base_price if explicitly 0 or not provided and product has 0 base_price
        if ((isset($validated['base_price']) && (float)$validated['base_price'] <= 0) || (!isset($validated['base_price']) && (float)$product->base_price <= 0)) {
            $derived = $this->deriveStartingPrice($validated, $pricingTiersData);
            if ($derived > 0) {
                $validated['base_price'] = $derived;
            }
        }

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
    public function archive(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

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
    public function bulkArchive(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $ids = array_values(array_unique($validated['ids']));
        $count = Product::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} product(s) moved to archive successfully.",
            'archived_count' => $count,
            'deleted_count' => $count,
        ]);
    }

    /**
     * Delete a product permanently from the database (or archive if explicitly requested).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $product = Product::withTrashed()->find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        // Check if soft-delete / archive was explicitly requested
        if ($request->boolean('archive')) {
            return $this->archive($request, $id);
        }

        // Prevent permanent deletion if customer orders reference this product (FK restrict)
        $hasOrders = DB::table('order_items')->where('product_id', $product->id)->exists();
        if ($hasOrders) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot permanently delete product because it is associated with existing customer orders. You may archive it instead.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $this->performPermanentProductDelete($product);
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Product permanently deleted successfully.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Failed to permanently delete product {$id}: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to permanently delete product: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Bulk permanently delete (or bulk archive) products.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
            'archive' => ['nullable', 'boolean'],
        ]);

        $ids = array_values(array_unique($validated['ids']));

        if ($request->boolean('archive')) {
            return $this->bulkArchive($request);
        }

        // Check if any product is associated with existing customer orders
        $productsWithOrders = DB::table('order_items')
            ->whereIn('product_id', $ids)
            ->pluck('product_id')
            ->unique();

        if ($productsWithOrders->isNotEmpty()) {
            $countWithOrders = $productsWithOrders->count();
            return response()->json([
                'success' => false,
                'message' => "Cannot permanently delete selected products: {$countWithOrders} product(s) are associated with existing customer orders. You may archive them instead.",
            ], 422);
        }

        DB::beginTransaction();
        try {
            $products = Product::withTrashed()->whereIn('id', $ids)->get();
            $deletedCount = 0;

            foreach ($products as $product) {
                $this->performPermanentProductDelete($product);
                $deletedCount++;
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$deletedCount} product(s) permanently deleted successfully.",
                'deleted_count' => $deletedCount,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Failed bulk permanent delete: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to permanently delete products: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Helper to permanently delete a product and cleanly handle product-owned records and files.
     */
    private function performPermanentProductDelete(Product $product): void
    {
        // 1. Clean up product-owned cart items
        DB::table('cart_items')->where('product_id', $product->id)->delete();

        // 2. Clean up product-owned mockups, shipping, inventory records
        DB::table('product_mockups')->where('product_id', $product->id)->delete();
        DB::table('product_shippings')->where('product_id', $product->id)->delete();
        DB::table('product_inventories')->where('product_id', $product->id)->delete();

        // 3. Nullify product_id in customer enquiries
        DB::table('customer_enquiries')->where('product_id', $product->id)->update(['product_id' => null]);

        // 4. Nullify product_id on saved user artworks (do not delete customer artworks)
        DB::table('artworks')->where('product_id', $product->id)->update(['product_id' => null]);

        // 5. Clean up product-owned design templates and their template pages
        $productTemplateIds = DB::table('design_templates')
            ->where('product_id', $product->id)
            ->pluck('id');

        if ($productTemplateIds->isNotEmpty()) {
            DB::table('design_template_pages')
                ->whereIn('design_template_id', $productTemplateIds)
                ->delete();

            DB::table('design_templates')
                ->whereIn('id', $productTemplateIds)
                ->delete();
        }

        // 6. Delete design_template_pages referencing this product's sides
        $sideIds = DB::table('product_sides')
            ->where('product_id', $product->id)
            ->pluck('id');

        if ($sideIds->isNotEmpty()) {
            DB::table('design_template_pages')
                ->whereIn('product_side_id', $sideIds)
                ->delete();
        }

        // 7. Delete local image files owned specifically by this product from storage
        $productImages = $product->images;
        foreach ($productImages as $image) {
            if (!empty($image->url) && str_contains($image->url, '/storage/products/')) {
                $path = str_replace(Storage::disk('public')->url(''), '', $image->url);
                $path = ltrim($path, '/');
                if (Storage::disk('public')->exists($path)) {
                    Storage::disk('public')->delete($path);
                }
            }
        }

        // 8. Permanently delete the product model (cascades variants, images, sides, print areas, attributes, pricing matrices)
        $product->forceDelete();
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

    /**
     * Duplicate (copy) an existing product with all configurations, sides, print areas, attributes, and pricing.
     */
    public function duplicate(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $source = Product::withTrashed()
            ->with(['sides.printAreas', 'attributes.values', 'pricingMatrices', 'images'])
            ->find($id);

        if (!$source) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        DB::beginTransaction();
        try {
            // Generate unique slug
            $baseSlug = Str::slug($source->name . ' copy');
            $uniqueSlug = $baseSlug;
            $counter = 1;
            while (Product::withTrashed()->where('slug', $uniqueSlug)->exists()) {
                $uniqueSlug = "{$baseSlug}-{$counter}";
                $counter++;
            }

            // Generate unique SKU
            $baseSku = $source->sku ? ($source->sku . '-COPY') : ('COPY-' . strtoupper(Str::random(6)));
            $uniqueSku = $baseSku;
            $skuCounter = 1;
            while ($uniqueSku && Product::withTrashed()->where('sku', $uniqueSku)->exists()) {
                $uniqueSku = "{$baseSku}-{$skuCounter}";
                $skuCounter++;
            }

            // Replicate main product model
            $newProduct = $source->replicate([
                'id',
                'created_at',
                'updated_at',
                'deleted_at',
            ]);

            $newProduct->name = $source->name . ' (Copy)';
            $newProduct->slug = $uniqueSlug;
            $newProduct->sku = $uniqueSku;
            $newProduct->status = 'draft';
            $newProduct->is_active = true;
            $newProduct->save();

            // 1. Copy sides and their print areas
            foreach ($source->sides as $side) {
                $newSide = $side->replicate([
                    'id',
                    'product_id',
                    'created_at',
                    'updated_at',
                ]);
                $newSide->product_id = $newProduct->id;
                $newSide->save();

                foreach ($side->printAreas as $area) {
                    $newArea = $area->replicate([
                        'id',
                        'product_id',
                        'product_side_id',
                        'created_at',
                        'updated_at',
                    ]);
                    $newArea->product_id = $newProduct->id;
                    $newArea->product_side_id = $newSide->id;
                    $newArea->save();
                }
            }

            // 2. Copy custom attributes and values
            foreach ($source->attributes as $attr) {
                $newAttr = $attr->replicate([
                    'id',
                    'product_id',
                    'created_at',
                    'updated_at',
                ]);
                $newAttr->product_id = $newProduct->id;
                $newAttr->save();

                foreach ($attr->values as $val) {
                    $newVal = $val->replicate([
                        'id',
                        'product_attribute_id',
                        'created_at',
                        'updated_at',
                    ]);
                    $newVal->product_attribute_id = $newAttr->id;
                    $newVal->save();
                }
            }

            // 3. Copy quantity pricing matrices
            foreach ($source->pricingMatrices as $matrix) {
                $newMatrix = $matrix->replicate([
                    'id',
                    'product_id',
                    'created_at',
                    'updated_at',
                ]);
                $newMatrix->product_id = $newProduct->id;
                $newMatrix->save();
            }

            // 4. Copy images (referencing same asset URLs)
            foreach ($source->images as $img) {
                $newImg = $img->replicate([
                    'id',
                    'product_id',
                    'created_at',
                    'updated_at',
                ]);
                $newImg->product_id = $newProduct->id;
                $newImg->save();
            }

            // 5. Copy shipping dimensions/weight if configured
            $sourceShipping = DB::table('product_shippings')->where('product_id', $source->id)->first();
            if ($sourceShipping) {
                $shippingData = (array) $sourceShipping;
                unset($shippingData['id'], $shippingData['created_at'], $shippingData['updated_at']);
                $shippingData['product_id'] = $newProduct->id;
                $shippingData['created_at'] = now();
                $shippingData['updated_at'] = now();
                DB::table('product_shippings')->insert($shippingData);
            }

            DB::commit();

            $newProduct->load(['category', 'images', 'sides.printAreas', 'attributes.values', 'pricingMatrices']);

            return response()->json([
                'success' => true,
                'message' => "Product copied successfully as \"{$newProduct->name}\".",
                'data' => new ProductResource($newProduct),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Failed to copy product {$id}: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to copy product: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Auto-derive starting base price from sale price, printing pricing tiers, or quantity tiers.
     */
    protected function deriveStartingPrice(array $validated, ?array $pricingTiersData): float
    {
        if (isset($validated['sale_price']) && (float) $validated['sale_price'] > 0) {
            return round((float) $validated['sale_price'], 2);
        }

        $printingPricing = $validated['printing_pricing'] ?? null;
        if (is_string($printingPricing)) {
            $printingPricing = json_decode($printingPricing, true);
        }

        if (!empty($printingPricing) && is_array($printingPricing)) {
            $gsmOptions = $printingPricing['gsm_options'] ?? [];
            if (!empty($gsmOptions) && is_array($gsmOptions)) {
                $minPrice = 0.0;
                foreach ($gsmOptions as $gsm) {
                    $tiers = $gsm['tiers'] ?? [];
                    if (!empty($tiers) && is_array($tiers)) {
                        foreach ($tiers as $t) {
                            $price = (float) ($t['total_price'] ?? $t['per_card_price'] ?? 0);
                            if ($price > 0 && ($minPrice === 0.0 || $price < $minPrice)) {
                                $minPrice = $price;
                            }
                        }
                    }
                }
                if ($minPrice > 0.0) {
                    return round($minPrice, 2);
                }
            }

            $options = $printingPricing['options'] ?? [];
            if (!empty($options) && is_array($options)) {
                $minPrice = 0.0;
                foreach ($options as $opt) {
                    $tiers = $opt['tiers'] ?? [];
                    if (!empty($tiers) && is_array($tiers)) {
                        foreach ($tiers as $t) {
                            $price = (float) ($t['total_price'] ?? $t['per_card_price'] ?? 0);
                            if ($price > 0 && ($minPrice === 0.0 || $price < $minPrice)) {
                                $minPrice = $price;
                            }
                        }
                    }
                }
                if ($minPrice > 0.0) {
                    return round($minPrice, 2);
                }
            }

            $sqm = $printingPricing['sqm_pricing'] ?? null;
            if (!empty($sqm['enabled']) && !empty($sqm['price_per_sqm'])) {
                return round((float) $sqm['price_per_sqm'], 2);
            }
        }

        if (!empty($pricingTiersData) && is_array($pricingTiersData)) {
            $minTier = 0.0;
            foreach ($pricingTiersData as $tier) {
                $p = (float) ($tier['price'] ?? $tier['unit_price_ex_gst'] ?? 0);
                if ($p > 0 && ($minTier === 0.0 || $p < $minTier)) {
                    $minTier = $p;
                }
            }
            if ($minTier > 0.0) {
                return round($minTier, 2);
            }
        }

        return 0.00;
    }
}
