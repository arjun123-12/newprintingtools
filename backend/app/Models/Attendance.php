<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Attendance extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_IDLE = 'idle';
    public const STATUS_ON_BREAK = 'on_break';
    public const STATUS_LOGGED_OUT = 'logged_out';

    protected $fillable = [
        'user_id',
        'date',
        'login_at',
        'logout_at',
        'last_heartbeat_at',
        'status',
        'active_seconds',
        'idle_seconds',
        'break_seconds',
        'total_duration_seconds',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'login_at' => 'datetime',
        'logout_at' => 'datetime',
        'last_heartbeat_at' => 'datetime',
        'active_seconds' => 'integer',
        'idle_seconds' => 'integer',
        'break_seconds' => 'integer',
        'total_duration_seconds' => 'integer',
    ];

    protected $appends = [
        'effective_status',
        'working_seconds',
        'session_duration_seconds',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function breaks(): HasMany
    {
        return $this->hasMany(AttendanceBreak::class);
    }

    public function activeBreak(): HasOne
    {
        return $this->hasOne(AttendanceBreak::class)
            ->whereNull('ended_at')
            ->latestOfMany();
    }

    /**
     * Compute effective status dynamically based on logout and heartbeat freshness.
     * If the browser connection is lost (no heartbeat in >150s), status shows 'disconnected'
     * rather than assuming the employee logged out.
     */
    public function getEffectiveStatusAttribute(): string
    {
        if ($this->logout_at !== null || $this->status === self::STATUS_LOGGED_OUT) {
            return self::STATUS_LOGGED_OUT;
        }

        if ($this->status === self::STATUS_ON_BREAK) {
            return self::STATUS_ON_BREAK;
        }

        $now = now();
        $staleThresholdSeconds = 150; // 2.5 heartbeat intervals of 60s
        $isHeartbeatStale = !$this->last_heartbeat_at || $this->last_heartbeat_at->diffInSeconds($now) > $staleThresholdSeconds;

        if ($isHeartbeatStale) {
            return 'disconnected';
        }

        return $this->status === self::STATUS_IDLE ? self::STATUS_IDLE : self::STATUS_ACTIVE;
    }

    /**
     * Total working hours excluding breaks (active seconds + idle seconds).
     */
    public function getWorkingSecondsAttribute(): int
    {
        return (int) ($this->active_seconds + $this->idle_seconds);
    }

    /**
     * Total overall elapsed session duration (from login_at to logout_at, or now if still active).
     */
    public function getSessionDurationSecondsAttribute(): int
    {
        if (!$this->login_at) {
            return 0;
        }

        $end = $this->logout_at ?: now();
        return max(0, $end->diffInSeconds($this->login_at));
    }
}
