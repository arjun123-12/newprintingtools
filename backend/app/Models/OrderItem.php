<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'order_id',
        'product_id',
        'product_name',
        'product_sku',
        'quantity',
        'unit_price_ex_gst',
        'unit_price_inc_gst',
        'total_price_inc_gst',
        'options_snapshot',
        'artwork_id',
        'designer_canvas_state',
        'production_status',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price_ex_gst' => 'decimal:4',
        'unit_price_inc_gst' => 'decimal:4',
        'total_price_inc_gst' => 'decimal:2',
        'options_snapshot' => 'array',
        'designer_canvas_state' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
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
