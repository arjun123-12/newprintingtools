<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DesignTemplate extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id',
        'name',
        'category',
        'print_sides',
        'width_mm',
        'height_mm',
        'margin_mm',
        'bleed_mm',
        'safe_area_mm',
        'canvas_json',
        'back_canvas_json',
        'artwork_config',
        'thumbnail_url',
        'is_active',
    ];

    protected $casts = [
        'canvas_json' => 'array',
        'back_canvas_json' => 'array',
        'width_mm' => 'decimal:2',
        'height_mm' => 'decimal:2',
        'margin_mm' => 'decimal:2',
        'bleed_mm' => 'decimal:2',
        'safe_area_mm' => 'decimal:2',
        'artwork_config' => 'array',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'template_json',
        'resolved_print_settings',
    ];

    public function getTemplateJsonAttribute(): mixed
    {
        return $this->canvas_json;
    }

    public function getResolvedPrintSettingsAttribute(): array
    {
        $product = $this->product;
        $hasCustomDimensions = $this->width_mm !== null || $this->height_mm !== null;

        $resolveGuide = function ($templateVal, $productVal) use ($hasCustomDimensions) {
            if ($templateVal !== null && (float) $templateVal > 0) {
                return (float) $templateVal;
            }
            if (! $hasCustomDimensions && $productVal !== null) {
                return (float) $productVal;
            }
            return (float) ($templateVal ?? $productVal ?? 0);
        };

        return [
            'print_sides' => $this->print_sides ?? $product?->print_sides ?? 'front',
            'width_mm' => $this->width_mm !== null ? (float) $this->width_mm : ($product?->width_mm !== null ? (float) $product->width_mm : null),
            'height_mm' => $this->height_mm !== null ? (float) $this->height_mm : ($product?->height_mm !== null ? (float) $product->height_mm : null),
            'margin_mm' => $resolveGuide($this->margin_mm, $product?->margin_mm),
            'bleed_mm' => $resolveGuide($this->bleed_mm, $product?->bleed_mm),
            'safe_area_mm' => $resolveGuide($this->safe_area_mm, $product?->safe_area_mm),
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function artworks(): HasMany
    {
        return $this->hasMany(Artwork::class, 'template_id');
    }
}