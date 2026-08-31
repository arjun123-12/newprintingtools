<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductInventory extends Model
{
    protected $fillable = [
        'product_id',
        'product_variant_id',
        'quantity_in_stock',
        'low_stock_threshold',
        'track_inventory',
    ];

    protected $casts = [
        'quantity_in_stock' => 'integer',
        'low_stock_threshold' => 'integer',
        'track_inventory' => 'boolean',
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
