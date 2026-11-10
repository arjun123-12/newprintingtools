<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientBrief extends Model
{
    protected $fillable = [
        'uuid',
        'token',
        'user_id',
        'spin_reward_ledger_id',

        'client_name',
        'company_name',
        'email',
        'phone',

        'request_type',
        'reorder_reference',

        'project_name',
        'product',
        'quantity',

        'width',
        'height',
        'unit',

        'print_sides',
        'fulfilment',
        'delivery_address',

        'colours',
        'description',
        'additional_notes',

        'requested_date',

        'status',
        'is_active',

        'expires_at',
        'submitted_at',
        'design_fee',
        'design_fee_accepted_at',
    ];

    protected $casts = [
        'quantity' => 'integer',

        'width' => 'decimal:2',
        'height' => 'decimal:2',

        'is_active' => 'boolean',

        'requested_date' => 'date',
        'expires_at' => 'datetime',
        'submitted_at' => 'datetime',
        'design_fee' => 'decimal:2',
        'design_fee_accepted_at' => 'datetime',
    ];

    protected $hidden = [
        'token',
    ];

    public function files(): HasMany
    {
        return $this->hasMany(ClientBriefFile::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ClientBriefMessage::class);
    }

    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }

    public function rewardLedger(): BelongsTo
    {
        return $this->belongsTo(CustomerRewardLedger::class, 'spin_reward_ledger_id');
    }
}
