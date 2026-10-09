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
            'print_sides' => ['nullable', 'string', 'in:front,back,both,multi'],
            'width_mm' => ['nullable', 'numeric', 'gt:0'],
            'height_mm' => ['nullable', 'numeric', 'gt:0'],
            'margin_mm' => ['nullable', 'numeric', 'min:0'],
            'bleed_mm' => ['nullable', 'numeric', 'min:0'],
            'safe_area_mm' => ['nullable', 'numeric', 'min:0'],
            'print_layout' => ['nullable', 'array'],
            'print_layout.width' => ['nullable', 'numeric', 'gt:0'],
            'print_layout.height' => ['nullable', 'numeric', 'gt:0'],
            'print_layout.orientation' => ['nullable', 'string', 'in:landscape,portrait'],
            'print_layout.outerBleed' => ['nullable', 'array'],
            'print_layout.outerBleed.top' => ['nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.right' => ['nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.bottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.outerBleed.left' => ['nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin' => ['nullable', 'array'],
            'print_layout.safeMargin.top' => ['nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.right' => ['nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.bottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.safeMargin.left' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding' => ['nullable', 'array'],
            'print_layout.folding.enabled' => ['nullable', 'boolean'],
            'print_layout.folding.type' => ['nullable', 'string', 'max:50'],
            'print_layout.folding.panelOrientation' => ['nullable', 'string', 'in:vertical,horizontal'],
            'print_layout.folding.panelCount' => ['nullable', 'integer', 'min:2'],
            'print_layout.folding.panels' => ['nullable', 'array'],
            'print_layout.folding.panels.*.width' => ['nullable', 'numeric', 'gt:0'],
            'print_layout.folding.folds' => ['nullable', 'array'],
            'print_layout.folding.folds.*.id' => ['nullable', 'string'],
            'print_layout.folding.folds.*.index' => ['nullable', 'integer'],
            'print_layout.folding.folds.*.position' => ['nullable', 'numeric', 'gt:0'],
            'print_layout.folding.folds.*.margin' => ['nullable'],
            'print_layout.folding.folds.*.margin.top' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.right' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.bottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.margin.left' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed' => ['nullable'],
            'print_layout.folding.folds.*.bleed.top' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.right' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.bottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleed.left' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginLeft' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginRight' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginTop' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.marginBottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedLeft' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedRight' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedTop' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.bleedBottom' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.folds.*.allowance' => ['nullable', 'numeric', 'min:0'],
            'print_layout.folding.sameMarginForAllFolds' => ['nullable', 'boolean'],
            'print_layout.folding.sameBleedForAllFolds' => ['nullable', 'boolean'],
            'print_layout.folding.uniformFoldMargin' => ['nullable'],
            'print_layout.folding.uniformFoldBleed' => ['nullable'],
            'print_layout.folding.sides' => ['nullable', 'array'],
            
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
            
            'sides' => ['nullable', 'array'],
            'sides.*.id' => ['nullable', 'string'],
            'sides.*.side_number' => ['required', 'integer'],
            'sides.*.name' => ['required', 'string', 'max:255'],
            'sides.*.type' => ['required', 'string', 'max:50'],
            'sides.*.sort_order' => ['nullable', 'integer'],
            'sides.*.is_active' => ['nullable', 'boolean'],
            'sides.*.background_color' => ['nullable', 'string', 'max:50'],
            'sides.*.background_image_url' => ['nullable', 'string', 'max:500'],
            'sides.*.preview_image_url' => ['nullable', 'string', 'max:500'],
            'sides.*.mockup_image_url' => ['nullable', 'string', 'max:500'],
            
            'sides.*.print_areas' => ['nullable', 'array'],
            'sides.*.print_areas.*.id' => ['nullable', 'string'],
            'sides.*.print_areas.*.name' => ['required', 'string', 'max:255'],
            'sides.*.print_areas.*.width_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.height_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.bleed_mm' => ['nullable', 'numeric', 'min:0'],
            'sides.*.print_areas.*.safe_zone_mm' => ['nullable', 'numeric', 'min:0'],

            // Folding Add-on Pricing
            'folding_pricing' => ['nullable', 'array'],
            'folding_pricing.enabled' => ['nullable', 'boolean'],
            'folding_pricing.pricing_method' => ['nullable', 'string', 'in:per_order,per_copy,quantity_based'],
            'folding_pricing.additional_charge' => ['nullable', 'numeric', 'min:0'],
            'folding_pricing.tiers' => ['nullable', 'array'],
            'folding_pricing.options' => ['nullable', 'array'],

            // Printing Configuration Pricing (Fixed-total quantity tiers)
            'printing_pricing' => ['nullable', 'array'],
            'printing_pricing.enabled' => ['nullable', 'boolean'],
            'printing_pricing.options' => ['nullable', 'array'],

            // Attributes and Dynamic Pricing Matrix
            'attributes' => ['nullable', 'array'],
            'pricing_tiers' => ['nullable', 'array'],
        ];
    }
}
