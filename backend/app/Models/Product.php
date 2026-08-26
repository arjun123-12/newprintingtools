<?php

namespace App\Models;

use App\Enums\ProductType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'sku',
        'short_description',
        'description',
        'product_type',
        'min_quantity',
        'turnaround_days',
        'is_active',
        'featured_image_url',
        'gallery_images',
    ];

    protected $casts = [
        'product_type' => ProductType::class,
        'min_quantity' => 'integer',
        'turnaround_days' => 'integer',
        'is_active' => 'boolean',
        'gallery_images' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class)->orderBy('sort_order');
    }

    public function printAreas(): HasMany
    {
        return $this->hasMany(ProductPrintArea::class);
    }

    public function pricingMatrices(): HasMany
    {
        return $this->hasMany(PricingMatrix::class)->orderBy('quantity');
    }

    public function templates(): HasMany
    {
        return $this->hasMany(DesignTemplate::class);
    }
}
