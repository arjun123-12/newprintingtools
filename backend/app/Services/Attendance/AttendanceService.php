<?php

namespace App\Services\Attendance;

use App\Models\Attendance;
use App\Models\AttendanceBreak;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class AttendanceService
{
    /**
     * Get currently active/open attendance session for the employee for today, if any exists.
     * Does NOT automatically create an attendance session.
     */
    public function getCurrentAttendance(User $user): ?Attendance
    {
        $today = Carbon::today()->toDateString();

        $attendance = Attendance::where('user_id', $user->id)
            ->where('date', $today)
            ->whereNull('logout_at')
            ->latest('id')
            ->first();

        return $attendance ? $attendance->load('activeBreak') : null;
    }

    /**
     * Explicitly start an attendance session when the employee clicks the attendance Login button.
     * Records server login date and time.
     * Prevents duplicate open sessions.
     */
    public function startAttendanceLogin(User $user, ?string $ip = null, ?string $userAgent = null): Attendance
    {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today, $ip, $userAgent) {
            // Check for existing open attendance for today
            $attendance = Attendance::where('user_id', $user->id)
                ->where('date', $today)
                ->whereNull('logout_at')
                ->lockForUpdate()
                ->first();

            if ($attendance) {
                if ($attendance->status === Attendance::STATUS_LOGGED_OUT) {
                    $attendance->status = Attendance::STATUS_ACTIVE;
                }
                $attendance->last_heartbeat_at = now();
                $attendance->save();

                return $attendance->load('activeBreak');
            }

            // Create new attendance session for today with Laravel server timestamp
            $attendance = Attendance::create([
                'user_id' => $user->id,
                'date' => $today,
                'login_at' => now(),
                'last_heartbeat_at' => now(),
                'status' => Attendance::STATUS_ACTIVE,
                'active_seconds' => 0,
                'idle_seconds' => 0,
                'break_seconds' => 0,
                'total_duration_seconds' => 0,
                'ip_address' => $ip,
                'user_agent' => $userAgent,
            ]);

            return $attendance->load('activeBreak');
        });
    }

    /**
     * Backward-compatible alias for getOrCreateTodayAttendance (used in existing callers if any).
     */
    public function getOrCreateTodayAttendance(User $user, ?string $ip = null, ?string $userAgent = null): Attendance
    {
        return $this->startAttendanceLogin($user, $ip, $userAgent);
    }

    /**
     * Record a periodic heartbeat (sent once every 60 seconds).
     * Only increments deltas if an open attendance session exists.
     */
    public function recordHeartbeat(
        User $user,
        int $activeSecondsDelta = 0,
        int $idleSecondsDelta = 0,
        ?string $status = null
    ): ?Attendance {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today, $activeSecondsDelta, $idleSecondsDelta, $status) {
            $attendance = Attendance::where('user_id', $user->id)
                ->where('date', $today)
                ->whereNull('logout_at')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                // If attendance is closed/logged out, heartbeat does not recreate it
                return null;
            }

            // Bound deltas safely to prevent tampered payloads
            $safeActiveDelta = min(max(0, $activeSecondsDelta), 120);
            $safeIdleDelta = min(max(0, $idleSecondsDelta), 120);

            // Check if user is currently on an active break
            $hasActiveBreak = $attendance->activeBreak()->exists();

            if ($hasActiveBreak) {
                // Pause activity accumulation while on break
                $attendance->status = Attendance::STATUS_ON_BREAK;
            } else {
                $attendance->active_seconds += $safeActiveDelta;
                $attendance->idle_seconds += $safeIdleDelta;
                $attendance->total_duration_seconds = (int) ($attendance->active_seconds + $attendance->idle_seconds);

                if ($status && in_array($status, [Attendance::STATUS_ACTIVE, Attendance::STATUS_IDLE], true)) {
                    $attendance->status = $status;
                }
            }

            $attendance->last_heartbeat_at = now();
            $attendance->save();

            return $attendance->load('activeBreak');
        });
    }

    /**
     * Update attendance activity status immediately (e.g. active <-> idle).
     */
    public function updateStatus(User $user, string $status): ?Attendance
    {
        if (!in_array($status, [Attendance::STATUS_ACTIVE, Attendance::STATUS_IDLE], true)) {
            throw new \InvalidArgumentException("Invalid attendance status: {$status}");
        }

        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today, $status) {
            $attendance = Attendance::where('user_id', $user->id)
                ->where('date', $today)
                ->whereNull('logout_at')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                return null;
            }

            // Do not override break status directly with active/idle without ending break
            if ($attendance->activeBreak()->exists()) {
                return $attendance->load('activeBreak');
            }

            $attendance->status = $status;
            $attendance->last_heartbeat_at = now();
            $attendance->save();

            return $attendance->load('activeBreak');
        });
    }

    /**
     * Start a break for the employee.
     */
    public function startBreak(User $user): AttendanceBreak
    {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today) {
            $attendance = Attendance::where('user_id', $user->id)
                ->where('date', $today)
                ->whereNull('logout_at')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                throw new \RuntimeException('No active attendance session found to start a break.');
            }

            // If an active break is already running, return it
            $existingBreak = AttendanceBreak::where('attendance_id', $attendance->id)
                ->whereNull('ended_at')
                ->first();

            if ($existingBreak) {
                $attendance->status = Attendance::STATUS_ON_BREAK;
                $attendance->last_heartbeat_at = now();
                $attendance->save();
                return $existingBreak;
            }

            $attendanceBreak = AttendanceBreak::create([
                'attendance_id' => $attendance->id,
                'started_at' => now(),
            ]);

            $attendance->status = Attendance::STATUS_ON_BREAK;
            $attendance->last_heartbeat_at = now();
            $attendance->save();

            return $attendanceBreak;
        });
    }

    /**
     * End the current break for the employee and resume active tracking.
     */
    public function endBreak(User $user): Attendance
    {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today) {
            $attendance = Attendance::where('user_id', $user->id)
                ->where('date', $today)
                ->whereNull('logout_at')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                throw new \RuntimeException('No active attendance session found.');
            }

            $openBreaks = AttendanceBreak::where('attendance_id', $attendance->id)
                ->whereNull('ended_at')
                ->get();

            $now = now();
            $totalNewBreakSeconds = 0;

            foreach ($openBreaks as $break) {
                $duration = max(0, $now->diffInSeconds($break->started_at));
                $break->ended_at = $now;
                $break->duration_seconds = $duration;
                $break->save();
                $totalNewBreakSeconds += $duration;
            }

            $attendance->break_seconds += $totalNewBreakSeconds;
            $attendance->status = Attendance::STATUS_ACTIVE;
            $attendance->last_heartbeat_at = $now;
            $attendance->save();

            return $attendance->load('activeBreak');
        });
    }

    /**
     * Safely close the attendance session when the employee clicks attendance Logout.
     * Records logout time and finalizes session duration, idle duration, break duration, and working hours.
     * Does NOT affect account authentication.
     */
    public function logout(User $user): ?Attendance
    {
        return DB::transaction(function () use ($user) {
            $attendance = Attendance::where('user_id', $user->id)
                ->whereNull('logout_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                return null;
            }

            $now = now();

            // Close any open break cleanly
            $openBreaks = AttendanceBreak::where('attendance_id', $attendance->id)
                ->whereNull('ended_at')
                ->get();

            foreach ($openBreaks as $break) {
                $duration = max(0, $now->diffInSeconds($break->started_at));
                $break->ended_at = $now;
                $break->duration_seconds = $duration;
                $break->save();
                $attendance->break_seconds += $duration;
            }

            $attendance->logout_at = $now;
            $attendance->status = Attendance::STATUS_LOGGED_OUT;
            $attendance->last_heartbeat_at = $now;
            $attendance->total_duration_seconds = (int) ($attendance->active_seconds + $attendance->idle_seconds);
            $attendance->save();

            return $attendance;
        });
    }

    /**
     * Query attendances for admin dashboard with filtering and pagination.
     */
    public function getAdminAttendances(array $filters = []): LengthAwarePaginator
    {
        $query = Attendance::with(['user:id,name,email,role,is_super_admin', 'activeBreak'])
            ->orderBy('date', 'desc')
            ->orderBy('login_at', 'desc');

        // Filter by employee search (name or email)
        if (!empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->whereHas('user', function (Builder $q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filter by specific date or date range
        if (!empty($filters['date'])) {
            $query->where('date', $filters['date']);
        } elseif (!empty($filters['from_date']) && !empty($filters['to_date'])) {
            $query->whereBetween('date', [$filters['from_date'], $filters['to_date']]);
        } elseif (!empty($filters['from_date'])) {
            $query->where('date', '>=', $filters['from_date']);
        } elseif (!empty($filters['to_date'])) {
            $query->where('date', '<=', $filters['to_date']);
        }

        // Filter by status (including disconnected)
        if (!empty($filters['status'])) {
            $status = $filters['status'];
            $staleThreshold = now()->subSeconds(150);

            if ($status === 'disconnected') {
                $query->whereNull('logout_at')
                    ->where(function ($q) use ($staleThreshold) {
                        $q->whereNull('last_heartbeat_at')
                            ->orWhere('last_heartbeat_at', '<', $staleThreshold);
                    });
            } elseif ($status === Attendance::STATUS_LOGGED_OUT) {
                $query->where(function ($q) {
                    $q->whereNotNull('logout_at')
                        ->orWhere('status', Attendance::STATUS_LOGGED_OUT);
                });
            } elseif ($status === Attendance::STATUS_ON_BREAK) {
                $query->whereNull('logout_at')
                    ->where('status', Attendance::STATUS_ON_BREAK)
                    ->where('last_heartbeat_at', '>=', $staleThreshold);
            } elseif ($status === Attendance::STATUS_IDLE) {
                $query->whereNull('logout_at')
                    ->where('status', Attendance::STATUS_IDLE)
                    ->where('last_heartbeat_at', '>=', $staleThreshold);
            } elseif ($status === Attendance::STATUS_ACTIVE) {
                $query->whereNull('logout_at')
                    ->where('status', Attendance::STATUS_ACTIVE)
                    ->where('last_heartbeat_at', '>=', $staleThreshold);
            }
        }

        $perPage = min(max(5, (int) ($filters['per_page'] ?? 15)), 100);

        return $query->paginate($perPage);
    }

    /**
     * Get aggregate statistics for the admin dashboard (e.g. today's metrics).
     */
    public function getSummaryStats(?string $date = null): array
    {
        $targetDate = $date ?: Carbon::today()->toDateString();
        $staleThreshold = now()->subSeconds(150);

        $todayAttendances = Attendance::where('date', $targetDate)->get();

        $activeCount = 0;
        $idleCount = 0;
        $onBreakCount = 0;
        $disconnectedCount = 0;
        $loggedOutCount = 0;
        $totalWorkingSeconds = 0;

        foreach ($todayAttendances as $att) {
            $totalWorkingSeconds += ($att->active_seconds + $att->idle_seconds);

            if ($att->logout_at !== null || $att->status === Attendance::STATUS_LOGGED_OUT) {
                $loggedOutCount++;
            } elseif ($att->status === Attendance::STATUS_ON_BREAK) {
                $onBreakCount++;
            } elseif (!$att->last_heartbeat_at || $att->last_heartbeat_at < $staleThreshold) {
                $disconnectedCount++;
            } elseif ($att->status === Attendance::STATUS_IDLE) {
                $idleCount++;
            } else {
                $activeCount++;
            }
        }

        return [
            'date' => $targetDate,
            'total_sessions' => $todayAttendances->count(),
            'active_count' => $activeCount,
            'idle_count' => $idleCount,
            'on_break_count' => $onBreakCount,
            'disconnected_count' => $disconnectedCount,
            'logged_out_count' => $loggedOutCount,
            'total_working_seconds' => $totalWorkingSeconds,
        ];
    }
}
