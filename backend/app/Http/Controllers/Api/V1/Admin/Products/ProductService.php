<?php

namespace App\Http\Controllers\Api\V1\Admin\Products;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

class ProductService
{
    protected ProductRepository $repository;

    public function __construct(ProductRepository $repository)
    {
        $this->repository = $repository;
    }

    /**
     * Create a new product.
     */
    public function createProduct(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            // Can add more complex logic here later (e.g. processing images)
            return $this->repository->create($data);
        });
    }
}
