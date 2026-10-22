<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'order_number',
        'user_id',
        'status',
        'payment_status',
        'subtotal_ex_gst',
        'gst_amount',
        'shipping_fee_inc_gst',
        'discount_amount',
        'total_inc_gst',
        'currency',
        'delivery_method',
        'shipping_address',
        'billing_address',
        'shipping_carrier',
        'tracking_number',
        'customer_notes',
        'admin_notes',
        'current_proof_version',
        'approved_proof_version',
        'proof_approved_at',
        'proof_approved_by',
        'reminder_sent_at',
    ];

    protected $casts = [
        'status' => OrderStatus::class,
        'payment_status' => PaymentStatus::class,
        'subtotal_ex_gst' => 'decimal:2',
        'gst_amount' => 'decimal:2',
        'shipping_fee_inc_gst' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_inc_gst' => 'decimal:2',
        'shipping_address' => 'array',
        'billing_address' => 'array',
        'current_proof_version' => 'integer',
        'approved_proof_version' => 'integer',
        'proof_approved_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function artworks(): HasMany
    {
        return $this->hasMany(Artwork::class);
    }

    public function primaryArtwork(): HasOne
    {
        return $this->hasOne(Artwork::class)->latestOfMany();
    }

    public function reviewLinks(): HasMany
    {
        return $this->hasMany(OrderReviewLink::class)->latest();
    }

    public function activeReviewLink(): HasOne
    {
        return $this->hasOne(OrderReviewLink::class)
            ->select('order_review_links.*')
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->whereNull('revoked_at')
            ->latestOfMany();
    }

    public function activities(): HasMany
    {
        return $this->hasMany(OrderActivity::class)->latest();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function latestShipment(): HasOne
    {
        return $this->hasOne(Shipment::class)->latestOfMany();
    }

    public function spinEntitlement(): HasOne
    {
        return $this->hasOne(OrderSpinEntitlement::class);
    }

    public function rewardLedger(): HasOne
    {
        return $this->hasOne(CustomerRewardLedger::class);
    }
}
