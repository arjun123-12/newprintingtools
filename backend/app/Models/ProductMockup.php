<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductMockup extends Model
{
    protected $fillable = [
        'product_id',
        'product_variant_id',
        'mockup_url',
        'overlay_coordinates',
    ];

    protected $casts = [
        'overlay_coordinates' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
