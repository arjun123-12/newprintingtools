<?php

namespace App\Http\Requests\Admin\Products;

use App\Enums\ProductType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Assuming RBAC middleware handles this
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
            'sku' => ['required', 'string', 'max:255', 'unique:products,sku'],
            'category_id' => ['required', 'exists:categories,id'],
            'product_type' => ['required', new Enum(ProductType::class)],

            'print_sides' => ['nullable', Rule::in(['front', 'back', 'both'])],
            'width_mm' => ['nullable', 'numeric', 'gt:0'],
            'height_mm' => ['nullable', 'numeric', 'gt:0'],
            'margin_mm' => ['nullable', 'numeric', 'min:0'],
            'bleed_mm' => ['nullable', 'numeric', 'min:0'],
            'safe_area_mm' => ['nullable', 'numeric', 'min:0'],
            
            'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            
            'min_quantity' => ['required', 'integer', 'min:1'],
            'turnaround_days' => ['required', 'integer', 'min:1'],
            
            'base_price' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'featured_image_url' => ['nullable', 'string', 'max:500'],
            
            'status' => ['nullable', 'string', 'in:draft,published,archived'],
            'is_active' => ['boolean'],
            'is_featured' => ['boolean'],
            
            'allow_custom_design' => ['boolean'],
            'allow_customer_upload' => ['boolean'],
            
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:255'],
        ];
    }
}
