<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shipment extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'order_id',
        'carrier',
        'consignment_code',
        'reference_number',
        'job_number',
        'rate_card_id',
        'rate_card_description',
        'freight_charge',
        'fuel_charge',
        'gst_charge',
        'total_charge',
        'label_url',
        'label_path',
        'status',
        'tracking_data',
        'request_payload',
        'response_payload',
        'shipped_at',
        'delivered_at',
    ];

    protected $casts = [
        'tracking_data' => 'array',
        'request_payload' => 'array',
        'response_payload' => 'array',
        'freight_charge' => 'decimal:2',
        'fuel_charge' => 'decimal:2',
        'gst_charge' => 'decimal:2',
        'total_charge' => 'decimal:2',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
