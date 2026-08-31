<?php

namespace App\Http\Controllers\Api\V1\Admin\ProductVariants;

use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

class ProductVariantService
{
    /**
     * Create a new product variant for a given product.
     */
    public function createVariant(string $productId, array $data): ProductVariant
    {
        $data['product_id'] = $productId;
        return DB::transaction(function () use ($data) {
            return ProductVariant::create($data);
        });
    }

    /**
     * Update an existing variant.
     */
    public function updateVariant(ProductVariant $variant, array $data): ProductVariant
    {
        return DB::transaction(function () use ($variant, $data) {
            $variant->update($data);
            return $variant;
        });
    }

    /**
     * Delete a variant.
     */
    public function deleteVariant(ProductVariant $variant): void
    {
        DB::transaction(function () use ($variant) {
            $variant->delete();
        });
    }
}
