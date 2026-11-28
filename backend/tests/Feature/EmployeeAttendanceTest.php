<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceBreak;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeAttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $staffUser;
    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staffUser = User::factory()->create([
            'name' => 'Alice Staff',
            'email' => 'alice@printcorp.com',
            'role' => User::ROLE_STAFF,
            'is_active' => true,
            'permissions' => ['orders'],
            'password' => bcrypt('password123'),
        ]);

        $this->adminUser = User::factory()->create([
            'name' => 'Super Admin',
            'email' => 'admin@printcorp.com',
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
            'is_active' => true,
            'password' => bcrypt('password123'),
        ]);
    }

    public function test_account_login_does_not_automatically_start_attendance(): void
    {
        // 1. Employee signs into their account
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'alice@printcorp.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200);

        // Attendance session must NOT be automatically created on account sign-in
        $this->assertEquals(0, Attendance::where('user_id', $this->staffUser->id)->count());

        $token = $response->json('data.token');

        // Current attendance is null until employee explicitly clicks attendance Login
        $resCurrent = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/attendance/current');
        $resCurrent->assertStatus(200);
        $this->assertNull($resCurrent->json('data.attendance'));
    }

    public function test_attendance_login_button_explicitly_starts_session(): void
    {
        $token = $this->staffUser->createToken('admin-panel', ['*'])->plainTextToken;

        // Click attendance Login button
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        $response->assertStatus(200);
        $this->assertEquals(1, Attendance::where('user_id', $this->staffUser->id)->count());

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertNotNull($attendance);
        $this->assertEquals(now()->toDateString(), $attendance->date->toDateString());
        $this->assertEquals(Attendance::STATUS_ACTIVE, $attendance->status);
        $this->assertNull($attendance->logout_at);
        $this->assertEquals(0, $attendance->active_seconds);

        // Multiple calls (or multi-tab login) return the same session without duplicates
        $res2 = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');
        $res2->assertStatus(200);
        $this->assertEquals(1, Attendance::where('user_id', $this->staffUser->id)->count());
    }

    public function test_heartbeat_accumulates_active_and_idle_seconds(): void
    {
        $token = $this->staffUser->createToken('test', ['*'])->plainTextToken;

        // Start attendance
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        // Send 60s heartbeat with 50s active, 10s idle
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/heartbeat', [
                'active_seconds_delta' => 50,
                'idle_seconds_delta' => 10,
                'status' => 'active',
            ]);

        $response->assertStatus(200);

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertEquals(50, $attendance->active_seconds);
        $this->assertEquals(10, $attendance->idle_seconds);
        $this->assertEquals(60, $attendance->total_duration_seconds);
        $this->assertEquals(60, $attendance->working_seconds);
        $this->assertEquals(Attendance::STATUS_ACTIVE, $attendance->status);
    }

    public function test_status_update_switches_between_active_and_idle(): void
    {
        $token = $this->staffUser->createToken('test', ['*'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        // Switch to idle (2 min inactivity detected)
        $res1 = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/status', ['status' => 'idle']);
        $res1->assertStatus(200);

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertEquals(Attendance::STATUS_IDLE, $attendance->status);

        // Resume activity
        $res2 = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/status', ['status' => 'active']);
        $res2->assertStatus(200);

        $attendance->refresh();
        $this->assertEquals(Attendance::STATUS_ACTIVE, $attendance->status);
    }

    public function test_break_lifecycle_and_inactivity_pause(): void
    {
        $token = $this->staffUser->createToken('test', ['*'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        // Start break
        $resStart = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/break/start');
        $resStart->assertStatus(200);

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertEquals(Attendance::STATUS_ON_BREAK, $attendance->status);
        $this->assertDatabaseHas('attendance_breaks', [
            'attendance_id' => $attendance->id,
            'ended_at' => null,
        ]);

        // Heartbeat while on break pauses active/idle increments
        $resHeartbeat = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/heartbeat', [
                'active_seconds_delta' => 60,
                'idle_seconds_delta' => 0,
            ]);
        $resHeartbeat->assertStatus(200);

        $attendance->refresh();
        $this->assertEquals(0, $attendance->active_seconds, 'Active seconds must not increment while on break');
        $this->assertEquals(Attendance::STATUS_ON_BREAK, $attendance->status);

        // End break
        $resEnd = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/break/end');
        $resEnd->assertStatus(200);

        $attendance->refresh();
        $this->assertEquals(Attendance::STATUS_ACTIVE, $attendance->status);
        $this->assertNull($attendance->activeBreak);
    }

    public function test_attendance_logout_does_not_revoke_account_auth(): void
    {
        $token = $this->staffUser->createToken('admin-panel', ['*'])->plainTextToken;

        // 1. Employee clocks in
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        // 2. Employee clocks out with attendance Logout button
        $resLogout = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/logout');
        $resLogout->assertStatus(200);

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertNotNull($attendance->logout_at);
        $this->assertEquals(Attendance::STATUS_LOGGED_OUT, $attendance->status);

        // 3. Verify user's Sanctum token is STILL valid and account is still logged in
        $resMe = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me');
        $resMe->assertStatus(200);
        $this->assertEquals('Alice Staff', $resMe->json('data.name'));
    }

    public function test_account_signout_safely_closes_active_attendance_session(): void
    {
        $token = $this->staffUser->createToken('admin-panel', ['*'])->plainTextToken;

        // 1. Employee clocks in
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/attendance/login');

        // 2. Employee signs out of account entirely
        $resAuthLogout = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/logout');
        $resAuthLogout->assertStatus(200);

        $attendance = Attendance::where('user_id', $this->staffUser->id)->first();
        $this->assertNotNull($attendance->logout_at, 'Account logout must safely close attendance session');
        $this->assertEquals(Attendance::STATUS_LOGGED_OUT, $attendance->status);
    }

    public function test_disconnected_status_when_heartbeat_is_stale_without_false_logout(): void
    {
        $attendance = Attendance::create([
            'user_id' => $this->staffUser->id,
            'date' => now()->toDateString(),
            'login_at' => now()->subHours(2),
            'last_heartbeat_at' => now()->subMinutes(5), // Stale (> 150s)
            'status' => Attendance::STATUS_ACTIVE,
            'active_seconds' => 3600,
            'idle_seconds' => 120,
        ]);

        $this->assertNull($attendance->logout_at, 'Employee must not be marked as logged out');
        $this->assertEquals('disconnected', $attendance->effective_status, 'Should compute disconnected when connection is lost');
    }

    public function test_admin_attendance_listing_and_summary(): void
    {
        Attendance::create([
            'user_id' => $this->staffUser->id,
            'date' => now()->toDateString(),
            'login_at' => now()->subHours(3),
            'last_heartbeat_at' => now(),
            'status' => Attendance::STATUS_ACTIVE,
            'active_seconds' => 7200,
            'idle_seconds' => 300,
            'break_seconds' => 600,
            'total_duration_seconds' => 7500,
        ]);

        $adminToken = $this->adminUser->createToken('admin-panel', ['*'])->plainTextToken;

        $resIndex = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->getJson('/api/v1/admin/attendances?search=Alice');
        $resIndex->assertStatus(200);
        $resIndex->assertJsonPath('pagination.total', 1);
        $this->assertEquals('Alice Staff', $resIndex->json('data.0.user.name'));

        $resSummary = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->getJson('/api/v1/admin/attendances/summary');
        $resSummary->assertStatus(200);
        $this->assertEquals(1, $resSummary->json('data.active_count'));
    }
}
