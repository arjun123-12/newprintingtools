<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderSpinEntitlement extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'order_id',
        'user_id',
        'spin_token',
        'status',
        'spun_at',
        'client_ip',
    ];

    protected $casts = [
        'spun_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function ledger(): HasOne
    {
        return $this->hasOne(CustomerRewardLedger::class, 'entitlement_id');
    }
}
