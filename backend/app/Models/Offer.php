<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offer extends Model
{
    protected $fillable = [
        'name',
        'code',
        'discount_type',
        'discount_value',
        'minimum_subtotal',
        'maximum_discount',
        'quantity',
        'product_details',
        'usage_limit',
        'usage_count',
        'starts_at',
        'ends_at',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'minimum_subtotal' => 'decimal:2',
            'maximum_discount' => 'decimal:2',
            'quantity' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(OfferCampaign::class);
    }
}
