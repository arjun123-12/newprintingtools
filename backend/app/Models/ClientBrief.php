<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientBrief extends Model
{
    protected $fillable = [
        'uuid',
        'token',

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
    ];

    protected $casts = [
        'quantity' => 'integer',

        'width' => 'decimal:2',
        'height' => 'decimal:2',

        'is_active' => 'boolean',

        'requested_date' => 'date',
        'expires_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    protected $hidden = [
        'token',
    ];

    public function files(): HasMany
    {
        return $this->hasMany(ClientBriefFile::class);
    }
}