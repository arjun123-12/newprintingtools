<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CartItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'cart_id',
        'product_id',
        'quantity',
        'selected_options',
        'artwork_id',
        'design_canvas_json',
        'unit_price_ex_gst',
        'subtotal_ex_gst',
        'gst_amount',
        'total_inc_gst',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'selected_options' => 'array',
        'design_canvas_json' => 'array',
        'unit_price_ex_gst' => 'decimal:4',
        'subtotal_ex_gst' => 'decimal:2',
        'gst_amount' => 'decimal:2',
        'total_inc_gst' => 'decimal:2',
    ];

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function artwork(): BelongsTo
    {
        return $this->belongsTo(Artwork::class);
    }
}
