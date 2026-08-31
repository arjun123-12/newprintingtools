<?php

namespace App\Http\Controllers\Api\V1\Admin\ProductImages;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\Product\ProductImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductImageController extends Controller
{
    public function __construct(
        protected ProductImageService $imageService
    ) {}

    /**
     * Upload and store a product image.
     */
    public function store(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'image' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
            'alt_text' => [
                'nullable',
                'string',
                'max:255',
            ],
            'is_featured' => [
                'nullable',
                'boolean',
            ],
            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ]);

        $product = Product::findOrFail($id);

        // The frontend uses this endpoint for the main product image.
        $isFeatured = $request->boolean('is_featured', true);

        $image = DB::transaction(function () use (
            $request,
            $validated,
            $product,
            $isFeatured
        ) {
            if ($isFeatured) {
                // Ensure that only the newly uploaded image is featured.
                $product->images()->update([
                    'is_featured' => false,
                ]);
            }

            return $this->imageService->storeImage(
                $product->id,
                [
                    'alt_text' => $validated['alt_text'] ?? $product->name,
                    'is_featured' => $isFeatured,
                    'sort_order' => $validated['sort_order'] ?? 0,
                ],
                $request->file('image')
            );
        });

        $responseData = $image->toArray();

        // Convert relative paths such as products/file.png into public URLs.
        if (
            !empty($responseData['url']) &&
            !filter_var($responseData['url'], FILTER_VALIDATE_URL)
        ) {
            $responseData['url'] = Storage::disk('public')
                ->url($responseData['url']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Image uploaded successfully.',
            'data' => $responseData,
        ], 201);
    }
}