<?php

namespace App\Http\Resources\Admin\Products;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $images = $this->relationLoaded('images') ? $this->images : collect([]);
        $printAreas = $this->relationLoaded('printAreas') ? $this->printAreas : collect([]);
        
        $featuredImage = $this->featured_image_url;
        if (empty($featuredImage) && $images->isNotEmpty()) {
            $featured = $images->where('is_featured', true)->where('side', 'front')->first() 
                ?? $images->where('side', 'front')->first() 
                ?? $images->first();
            $featuredImage = $featured?->url;
        }

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name ?? 'Uncategorized',
            'category' => $this->category,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'product_type' => $this->product_type?->value ?? $this->product_type,
            'min_quantity' => $this->min_quantity,
            'turnaround_days' => $this->turnaround_days,
            'base_price' => $this->base_price,
            'sale_price' => $this->sale_price,
            'cost_price' => $this->cost_price,
            'featured_image_url' => $featuredImage,
            'images' => $images, // Keeping this for backward compatibility
            
            'sides' => $this->relationLoaded('sides') ? $this->sides->map(function ($side) {
                return [
                    'id' => $side->id,
                    'side_number' => $side->side_number,
                    'name' => $side->name,
                    'type' => $side->type,
                    'sort_order' => $side->sort_order,
                    'is_active' => $side->is_active,
                    'background_color' => $side->background_color,
                    'background_image_url' => $side->background_image_url,
                    'preview_image_url' => $side->preview_image_url,
                    'mockup_image_url' => $side->mockup_image_url,
                    'print_areas' => $side->relationLoaded('printAreas') ? $side->printAreas : collect([]),
                ];
            }) : collect([]),
            
            'status' => $this->status,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'allow_custom_design' => $this->allow_custom_design,
            'allow_customer_upload' => $this->allow_customer_upload,
            'print_sides' => $this->print_sides,
            'width_mm' => $this->width_mm !== null ? (float) $this->width_mm : null,
            'height_mm' => $this->height_mm !== null ? (float) $this->height_mm : null,
            'margin_mm' => (float) ($this->margin_mm ?? 0),
            'bleed_mm' => (float) ($this->bleed_mm ?? 0),
            'safe_area_mm' => (float) ($this->safe_area_mm ?? 0),
            'print_layout' => $this->print_layout,
            'folding_pricing' => $this->folding_pricing,
            'printing_pricing' => $this->printing_pricing,

            'attributes' => $this->relationLoaded('attributes') ? $this->attributes->map(function ($attr) {
                return [
                    'id' => $attr->id,
                    'name' => $attr->name,
                    'code' => $attr->code,
                    'type' => $attr->type,
                    'is_required' => (bool) $attr->is_required,
                    'sort_order' => $attr->sort_order,
                    'values' => $attr->relationLoaded('values') ? $attr->values->map(function ($val) {
                        $rawDesc = $val->description;
                        $parsedDesc = json_decode((string) $rawDesc, true);
                        $finalDesc = $rawDesc;
                        $isActive = true;
                        $priceModifiers = [];

                        if (is_array($parsedDesc) && (isset($parsedDesc['priceModifiers']) || isset($parsedDesc['is_active']))) {
                            $finalDesc = $parsedDesc['text'] ?? '';
                            $isActive = $parsedDesc['is_active'] ?? true;
                            $priceModifiers = $parsedDesc['priceModifiers'] ?? [];
                        }

                        return [
                            'id' => $val->id,
                            'label' => $val->label,
                            'value' => $val->value,
                            'description' => $finalDesc,
                            'price_modifier_type' => $val->price_modifier_type,
                            'price_modifier_amount' => (float) $val->price_modifier_amount,
                            'sort_order' => $val->sort_order,
                            'is_default' => $val->sort_order === 0,
                            'is_active' => $isActive,
                            'priceModifiers' => $priceModifiers,
                        ];
                    }) : [],
                ];
            }) : [],

            'pricing_tiers' => $this->relationLoaded('pricingMatrices') ? $this->pricingMatrices->map(function ($matrix) {
                return [
                    'id' => $matrix->id,
                    'minQuantity' => (int) $matrix->quantity,
                    'maxQuantity' => null,
                    'price' => (float) $matrix->unit_price_ex_gst,
                ];
            }) : [],

            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at?->toIso8601String(),
            'is_archived' => $this->trashed(),
        ];
    }
}
