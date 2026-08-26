<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductAttributeValue extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_attribute_id',
        'label',
        'value',
        'description',
        'price_modifier_type',
        'price_modifier_amount',
        'sort_order',
    ];

    protected $casts = [
        'price_modifier_amount' => 'decimal:4',
        'sort_order' => 'integer',
    ];

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(ProductAttribute::class, 'product_attribute_id');
    }
}
