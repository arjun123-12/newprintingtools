<?php

namespace App\Http\Controllers\Api\V1\Admin\Products;
use App\Http\Requests\Admin\Products\UpdateProductRequest;
use App\Models\Product;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Products\StoreProductRequest;
use App\Http\Resources\Admin\Products\ProductResource;
use Illuminate\Http\JsonResponse;
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
        $sides = $validated['sides'] ?? [];
        unset($validated['sides']);

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
        
        $product->load(['category', 'images', 'sides.printAreas']);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => new ProductResource($product)
        ], 201);
    }
    
    public function index(): JsonResponse
    {
        $products = Product::with(['category', 'images', 'sides.printAreas'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $product = Product::with(['category', 'images', 'sides.printAreas'])
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
        
        DB::transaction(function () use ($product, $validated) {
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
        });
        
        $product->load(['category', 'images', 'sides.printAreas']);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => new ProductResource($product),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
        ]);
    }
}
