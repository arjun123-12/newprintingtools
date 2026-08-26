<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PricingMatrix extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_id',
        'quantity',
        'unit_price_ex_gst',
        'setup_fee',
        'discount_percentage',
        'option_pricing_overrides',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price_ex_gst' => 'decimal:4',
        'setup_fee' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'option_pricing_overrides' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
