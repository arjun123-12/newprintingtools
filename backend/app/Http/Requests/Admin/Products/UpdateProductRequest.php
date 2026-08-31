<?php

namespace App\Http\Requests\Admin\Products;

use App\Enums\ProductType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $productId = $this->route('id');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('products', 'slug')->ignore($productId),
            ],
            'sku' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],
            'category_id' => [
                'sometimes',
                'required',
                'exists:categories,id',
            ],
            'product_type' => [
                'sometimes',
                'required',
                new Enum(ProductType::class),
            ],
            'short_description' => [
                'nullable',
                'string',
                'max:500',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'min_quantity' => [
                'sometimes',
                'required',
                'integer',
                'min:1',
            ],
            'turnaround_days' => [
                'sometimes',
                'required',
                'integer',
                'min:1',
            ],
            'base_price' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
            ],
            'sale_price' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'status' => [
                'sometimes',
                'string',
                'in:draft,published,archived',
            ],
            'is_active' => [
                'sometimes',
                'boolean',
            ],
            'allow_custom_design' => [
                'sometimes',
                'boolean',
            ],
            'allow_customer_upload' => [
                'sometimes',
                'boolean',
            ],
            'featured_image_url' => [
                'nullable',
                'string',
            ],
        ];
    }
}
