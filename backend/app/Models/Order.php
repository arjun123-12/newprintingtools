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
        'business_category',
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
        'order_cutoff_time',
        'order_cutoff_timezone',
        'proof_watermark_opacity',
        'production_days',
        'turnaround_duration_value',
        'turnaround_duration_unit',
        'turnaround_day_type',
        'turnaround_started_at',
        'estimated_completion_at',
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
        'proof_watermark_opacity' => 'integer',
        'production_days' => 'integer',
        'turnaround_duration_value' => 'integer',
        'turnaround_started_at' => 'datetime',
        'estimated_completion_at' => 'datetime',
    ];

    /**
     * Calculate estimated completion timestamp based on duration, unit, day type and starting date.
     */
    public function calculateEstimatedCompletion(?\Carbon\CarbonInterface $startDate = null): \Carbon\Carbon
    {
        $start = $startDate
            ? $startDate->copy()
            : ($this->turnaround_started_at ? $this->turnaround_started_at->copy() : now());

        $tz = $this->order_cutoff_timezone ?: 'Australia/Sydney';
        $date = \Carbon\Carbon::parse($start)->setTimezone($tz);

        $value = (int) ($this->turnaround_duration_value ?: ($this->production_days ?: 3));
        $unit = strtolower((string) ($this->turnaround_duration_unit ?: 'days'));
        $dayType = strtolower((string) ($this->turnaround_day_type ?: 'business'));

        if ($unit === 'hours') {
            return $date->addHours($value);
        }

        if ($dayType === 'calendar') {
            return $date->addDays($value);
        }

        // Business days: skip Saturday & Sunday
        $added = 0;
        while ($added < $value) {
            $date->addDay();
            if ($date->isWeekday()) {
                $added++;
            }
        }

        return $date;
    }

    /**
     * Determine if order is in a completed status.
     */
    public function isCompleted(): bool
    {
        $statusStr = $this->status instanceof OrderStatus ? $this->status->value : (string) $this->status;
        return in_array($statusStr, ['delivered', 'collected', 'completed'], true);
    }

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
