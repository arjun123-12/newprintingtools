<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductShipping extends Model
{
    protected $fillable = [
        'product_id',
        'weight',
        'length',
        'width',
        'height',
        'is_free_shipping',
        'fixed_shipping_cost',
    ];

    protected $casts = [
        'weight' => 'decimal:2',
        'length' => 'decimal:2',
        'width' => 'decimal:2',
        'height' => 'decimal:2',
        'is_free_shipping' => 'boolean',
        'fixed_shipping_cost' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
