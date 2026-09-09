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
            'print_sides' => [
                'sometimes',
                'nullable',
                'string',
                'in:front,back,both,multi',
            ],
            'width_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],
            'height_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],
            'margin_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'bleed_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'safe_area_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
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
            'sides' => [
                'sometimes',
                'nullable',
                'array',
            ],
            'sides.*.id' => ['nullable', 'string'],
            'sides.*.side_number' => ['required_with:sides', 'integer'],
            'sides.*.name' => ['required_with:sides', 'string', 'max:255'],
            'sides.*.type' => ['required_with:sides', 'string', 'max:50'],
            'sides.*.sort_order' => ['nullable', 'integer'],
            'sides.*.is_active' => ['nullable', 'boolean'],
            'sides.*.background_color' => ['nullable', 'string', 'max:50'],
            'sides.*.background_image_url' => ['nullable', 'string', 'max:500'],
            'sides.*.preview_image_url' => ['nullable', 'string', 'max:500'],
            'sides.*.mockup_image_url' => ['nullable', 'string', 'max:500'],
            
            'sides.*.print_areas' => ['nullable', 'array'],
            'sides.*.print_areas.*.id' => ['nullable', 'string'],
            'sides.*.print_areas.*.name' => ['required_with:sides.*.print_areas', 'string', 'max:255'],
            'sides.*.print_areas.*.width_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.height_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.bleed_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.safe_zone_mm' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
