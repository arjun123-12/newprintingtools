<?php

namespace App\Http\Controllers\Api\V1\Admin\Products;

use App\Models\Product;

class ProductRepository
{
    /**
     * Create a new product in the database.
     */
    public function create(array $data): Product
    {
        return Product::create($data);
    }
}
