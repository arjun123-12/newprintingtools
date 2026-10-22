<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpinReward extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'title',
        'reward_type',
        'badge_text',
        'value',
        'description',
        'terms_text',
        'how_to_use',
        'color_bg',
        'color_text',
        'icon',
        'probability_weight',
        'min_order_spend',
        'expiry_days',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'min_order_spend' => 'decimal:2',
        'probability_weight' => 'integer',
        'expiry_days' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function ledgers(): HasMany
    {
        return $this->hasMany(CustomerRewardLedger::class);
    }
}
