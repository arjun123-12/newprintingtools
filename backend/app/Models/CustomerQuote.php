<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerQuote extends Model
{
    protected $fillable = [
        'customer_enquiry_id', 'created_by', 'recipient_name', 'recipient_email', 'order_id', 'quote_number', 'token_hash',
        'items', 'delivery_method', 'delivery_address', 'terms', 'currency',
        'subtotal_ex_gst', 'shipping_fee_inc_gst', 'gst_amount', 'total_inc_gst',
        'status', 'expires_at', 'accepted_at', 'declined_at',
    ];

    protected $casts = [
        'items' => 'array',
        'subtotal_ex_gst' => 'decimal:2',
        'shipping_fee_inc_gst' => 'decimal:2',
        'gst_amount' => 'decimal:2',
        'total_inc_gst' => 'decimal:2',
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'declined_at' => 'datetime',
    ];

    protected $hidden = ['token_hash'];

    public function enquiry(): BelongsTo
    {
        return $this->belongsTo(CustomerEnquiry::class, 'customer_enquiry_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
