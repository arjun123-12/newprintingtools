<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SpinRewardCategory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'icon',
        'is_default',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Rewards associated directly with this category.
     */
    public function rewards(): HasMany
    {
        return $this->hasMany(SpinReward::class, 'category_id')->orderBy('sort_order', 'asc');
    }

    /**
     * Active rewards associated with this category.
     */
    public function activeRewards(): HasMany
    {
        return $this->rewards()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('inventory')->orWhere('inventory', '>', 0);
            });
    }

    /**
     * Durable reward ledger entries issued under this category.
     */
    public function ledgers(): HasMany
    {
        return $this->hasMany(CustomerRewardLedger::class, 'category_id');
    }

    /**
     * Check if this category is safe to hard delete or if it has reward history.
     */
    public function hasHistory(): bool
    {
        return $this->ledgers()->exists() || $this->rewards()->exists();
    }
}
