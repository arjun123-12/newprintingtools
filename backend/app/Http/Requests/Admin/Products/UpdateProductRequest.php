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
            'print_layout' => [
                'sometimes',
                'nullable',
                'array',
            ],
            'print_layout.width' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'print_layout.height' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'print_layout.orientation' => ['sometimes', 'nullable', 'string', 'in:landscape,portrait'],
            'print_layout.outerBleed' => ['sometimes', 'nullable', 'array'],
            'print_layout.outerBleed.top' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.right' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.bottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.left' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin' => ['sometimes', 'nullable', 'array'],
            'print_layout.safeMargin.top' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.right' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.bottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.left' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding' => ['sometimes', 'nullable', 'array'],
            'print_layout.folding.enabled' => ['sometimes', 'nullable', 'boolean'],
            'print_layout.folding.type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'print_layout.folding.panelOrientation' => ['sometimes', 'nullable', 'string', 'in:vertical,horizontal'],
            'print_layout.folding.panelCount' => ['sometimes', 'nullable', 'integer', 'min:2'],
            'print_layout.folding.panels' => ['sometimes', 'nullable', 'array'],
            'print_layout.folding.panels.*.width' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'print_layout.folding.folds' => ['sometimes', 'nullable', 'array'],
            'print_layout.folding.folds.*.id' => ['sometimes', 'nullable', 'string'],
            'print_layout.folding.folds.*.index' => ['sometimes', 'nullable', 'integer'],
            'print_layout.folding.folds.*.position' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'print_layout.folding.folds.*.margin' => ['sometimes', 'nullable'],
            'print_layout.folding.folds.*.margin.top' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.right' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.bottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.left' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed' => ['sometimes', 'nullable'],
            'print_layout.folding.folds.*.bleed.top' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.right' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.bottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.left' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginLeft' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginRight' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginTop' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginBottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedLeft' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedRight' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedTop' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedBottom' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.allowance' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'print_layout.folding.sameMarginForAllFolds' => ['sometimes', 'nullable', 'boolean'],
            'print_layout.folding.sameBleedForAllFolds' => ['sometimes', 'nullable', 'boolean'],
            'print_layout.folding.uniformFoldMargin' => ['sometimes', 'nullable'],
            'print_layout.folding.uniformFoldBleed' => ['sometimes', 'nullable'],
            'print_layout.folding.sides' => ['sometimes', 'nullable', 'array'],
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
