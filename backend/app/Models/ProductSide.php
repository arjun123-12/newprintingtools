<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductSide extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_id',
        'side_number',
        'name',
        'type',
        'sort_order',
        'is_active',
        'background_color',
        'background_image_url',
        'preview_image_url',
        'mockup_image_url',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'side_number' => 'integer',
        'sort_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function printAreas(): HasMany
    {
        return $this->hasMany(ProductPrintArea::class);
    }

    public function templatePages(): HasMany
    {
        return $this->hasMany(DesignTemplatePage::class);
    }

    public function artworkPages(): HasMany
    {
        return $this->hasMany(ArtworkPage::class);
    }
}
