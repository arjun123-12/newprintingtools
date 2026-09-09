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

    /**
     * Fields that can be mass assigned.
     */
    protected $fillable = [
        // Basic information
        'category_id',
        'name',
        'slug',
        'sku',
        'short_description',
        'description',
        'product_type',

        // Quantity and production
        'min_quantity',
        'turnaround_days',

        // Pricing
        'base_price',
        'sale_price',
        'cost_price',

        // Product images
        'featured_image_url',
        'gallery_images',

        // Status
        'status',
        'is_active',
        'is_featured',

        // Design settings
        'allow_custom_design',
        'allow_customer_upload',

        // Print specifications
        'print_sides',
        'width_mm',
        'height_mm',
        'margin_mm',
        'bleed_mm',
        'safe_area_mm',

        // SEO
        'meta_title',
        'meta_description',
    ];

    /**
     * Attribute type casting.
     */
    protected $casts = [
        // Enum
        'product_type' => ProductType::class,

        // Integers
        'min_quantity' => 'integer',
        'turnaround_days' => 'integer',
        'print_sides' => 'string',

        // Print measurements
        'width_mm' => 'decimal:2',
        'height_mm' => 'decimal:2',
        'margin_mm' => 'decimal:2',
        'bleed_mm' => 'decimal:2',
        'safe_area_mm' => 'decimal:2',

        // Pricing
        'base_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'cost_price' => 'decimal:2',

        // Booleans
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'allow_custom_design' => 'boolean',
        'allow_customer_upload' => 'boolean',

        // JSON
        'gallery_images' => 'array',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * Product category.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Product custom attributes.
     */
    public function attributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class)
            ->orderBy('sort_order');
    }

    /**
     * Product print areas.
     */
    public function printAreas(): HasMany
    {
        return $this->hasMany(ProductPrintArea::class);
    }

    /**
     * Product pricing matrices.
     */
    public function pricingMatrices(): HasMany
    {
        return $this->hasMany(PricingMatrix::class)
            ->orderBy('quantity');
    }

    /**
     * Product design templates.
     */
    public function templates(): HasMany
    {
        return $this->hasMany(DesignTemplate::class);
    }

    /**
     * Product variants.
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    /**
     * Product printable sides.
     */
    public function sides(): HasMany
    {
        return $this->hasMany(ProductSide::class)
            ->orderBy('sort_order');
    }

    /**
     * Product gallery and featured images.
     */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)
            ->orderByDesc('is_featured')
            ->orderBy('sort_order');
    }
} // 