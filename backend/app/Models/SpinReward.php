<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpinReward extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
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
        'inventory',
        'inventory_consumed',
        'min_order_spend',
        'expiry_days',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'category_id' => 'integer',
        'value' => 'decimal:2',
        'min_order_spend' => 'decimal:2',
        'probability_weight' => 'integer',
        'inventory' => 'integer',
        'inventory_consumed' => 'integer',
        'expiry_days' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(SpinRewardCategory::class, 'category_id')->withTrashed();
    }

    public function ledgers(): HasMany
    {
        return $this->hasMany(CustomerRewardLedger::class);
    }

    /**
     * Determine if reward is currently available (active and has remaining inventory if capped).
     */
    public function isAvailable(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->inventory !== null && $this->inventory <= 0) {
            return false;
        }

        return true;
    }
}
