<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAuditLog extends Model
{
    use HasFactory;

    protected $table = 'staff_audit_logs';

    protected $fillable = [
        'actor_id',
        'actor_name',
        'actor_email',
        'affected_user_id',
        'affected_user_name',
        'affected_user_email',
        'action',
        'details',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function affectedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'affected_user_id');
    }
}
