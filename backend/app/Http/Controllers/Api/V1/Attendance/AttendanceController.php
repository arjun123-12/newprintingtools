<?php

namespace App\Http\Controllers\Api\V1\Attendance;

use App\Http\Controllers\Controller;
use App\Services\Attendance\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        protected AttendanceService $attendanceService
    ) {}

    /**
     * Get the current open attendance session for the employee if running.
     * Does NOT automatically create or start an attendance session.
     */
    public function current(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $attendance = $this->attendanceService->getCurrentAttendance($user);

        return response()->json([
            'success' => true,
            'data' => [
                'attendance' => $attendance,
                'active_break' => $attendance?->activeBreak,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Explicit attendance login (Clock In) when the employee clicks the attendance Login button.
     * Records server login date and time.
     * Does NOT alter the user's account authentication session.
     */
    public function login(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $attendance = $this->attendanceService->startAttendanceLogin(
            $user,
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Attendance session started successfully.',
            'data' => [
                'attendance' => $attendance,
                'active_break' => $attendance->activeBreak,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Process 60-second periodic heartbeat from the active employee tab.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $validated = $request->validate([
            'active_seconds_delta' => ['nullable', 'integer', 'min:0', 'max:120'],
            'idle_seconds_delta' => ['nullable', 'integer', 'min:0', 'max:120'],
            'status' => ['nullable', 'string', 'in:active,idle,on_break'],
        ]);

        $attendance = $this->attendanceService->recordHeartbeat(
            $user,
            (int) ($validated['active_seconds_delta'] ?? 0),
            (int) ($validated['idle_seconds_delta'] ?? 0),
            $validated['status'] ?? null
        );

        return response()->json([
            'success' => true,
            'data' => [
                'attendance' => $attendance,
                'active_break' => $attendance?->activeBreak,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Immediately update employee activity status (e.g. active <-> idle).
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,idle'],
        ]);

        $attendance = $this->attendanceService->updateStatus(
            $user,
            $validated['status']
        );

        return response()->json([
            'success' => true,
            'data' => [
                'attendance' => $attendance,
                'active_break' => $attendance?->activeBreak,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Start a break for the employee.
     */
    public function startBreak(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $break = $this->attendanceService->startBreak($user);
        $attendance = $break->attendance()->with('activeBreak')->first();

        return response()->json([
            'success' => true,
            'message' => 'Break started.',
            'data' => [
                'break' => $break,
                'attendance' => $attendance,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * End current break for the employee.
     */
    public function endBreak(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance tracking is only applicable to employee accounts.',
            ], 403);
        }

        $attendance = $this->attendanceService->endBreak($user);

        return response()->json([
            'success' => true,
            'message' => 'Break ended. Active work resumed.',
            'data' => [
                'attendance' => $attendance,
                'active_break' => null,
                'server_time' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Explicit attendance logout (Clock Out) when employee clicks the attendance Logout button.
     * Does NOT sign the employee out of their account or revoke their Sanctum token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        $closedAttendance = null;
        if ($user && $user->canAccessAdminPanel()) {
            $closedAttendance = $this->attendanceService->logout($user);
        }

        return response()->json([
            'success' => true,
            'message' => 'Attendance session closed successfully.',
            'data' => [
                'attendance' => $closedAttendance,
            ],
        ]);
    }

    /**
     * Admin attendance dashboard records listing with filters and pagination.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'from_date' => ['nullable', 'date_format:Y-m-d'],
            'to_date' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['nullable', 'string', 'in:active,idle,on_break,logged_out,disconnected'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $paginator = $this->attendanceService->getAdminAttendances($validated);

        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Summary statistics for admin attendance dashboard.
     */
    public function adminSummary(Request $request): JsonResponse
    {
        $date = $request->query('date');
        if ($date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = null;
        }

        $summary = $this->attendanceService->getSummaryStats($date);

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }
}
