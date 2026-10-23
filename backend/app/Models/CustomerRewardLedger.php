<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerRewardLedger extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'entitlement_id',
        'order_id',
        'user_id',
        'spin_reward_id',
        'category_id',
        'category_name',
        'reward_code',
        'reward_type',
        'title',
        'badge_text',
        'value',
        'terms',
        'how_to_use',
        'expires_at',
        'status',
        'redeemed_at',
        'redeemed_order_id',
        'claim_token',
        'reward_email_sent_at',
    ];

    protected $casts = [
        'category_id' => 'integer',
        'value' => 'decimal:2',
        'expires_at' => 'datetime',
        'redeemed_at' => 'datetime',
        'reward_email_sent_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(SpinRewardCategory::class, 'category_id')->withTrashed();
    }

    public function entitlement(): BelongsTo
    {
        return $this->belongsTo(OrderSpinEntitlement::class, 'entitlement_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function spinReward(): BelongsTo
    {
        return $this->belongsTo(SpinReward::class);
    }

    public function redeemedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'redeemed_order_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isRedeemable(): bool
    {
        return $this->status === 'active' && ! $this->isExpired();
    }
}
