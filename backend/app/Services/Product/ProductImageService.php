<?php

namespace App\Services\Product;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Support\Facades\Storage;

class ProductImageService
{
    /**
     * Store a new image for a product.
     */
    public function storeImage(string $productId, array $data, $imageFile): ProductImage
    {
        // Store the file
        $path = $imageFile->store('products', 'public');
        $url = Storage::disk('public')->url($path);
        
        $data['product_id'] = $productId;
        $data['url'] = $url;
        
        $image = ProductImage::create($data);

        // Also update product's featured_image_url
        $product = Product::find($productId);
        if ($product) {
            $isFeatured = !empty($data['is_featured']);
            if ($isFeatured || empty($product->featured_image_url)) {
                $product->update([
                    'featured_image_url' => $url,
                ]);
            }
        }

        return $image;
    }
}
