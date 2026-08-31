<?php

namespace App\Http\Requests\Admin\ProductVariants;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductVariantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // RBAC handled elsewhere
    }

    public function rules(): array
    {
        $variantId = $this->route('id');
        return [
            'sku' => ['required', 'string', 'max:255', "unique:product_variants,sku,$variantId"],
            'price_modifier' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }
}
