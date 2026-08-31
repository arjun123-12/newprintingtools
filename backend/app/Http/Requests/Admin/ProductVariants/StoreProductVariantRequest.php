<?php

namespace App\Http\Requests\Admin\ProductVariants;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductVariantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // RBAC handled elsewhere
    }

    public function rules(): array
    {
        return [
            'sku' => ['required', 'string', 'max:255',],
            'price_modifier' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }
}
