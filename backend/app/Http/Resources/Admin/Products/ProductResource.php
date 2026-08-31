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
        $featuredImage = $this->featured_image_url;
        if (empty($featuredImage) && $this->relationLoaded('images')) {
            $featured = $this->images->where('is_featured', true)->first() ?? $this->images->first();
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
            'images' => $this->relationLoaded('images') ? $this->images : [],
            'status' => $this->status,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'allow_custom_design' => $this->allow_custom_design,
            'allow_customer_upload' => $this->allow_customer_upload,
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
