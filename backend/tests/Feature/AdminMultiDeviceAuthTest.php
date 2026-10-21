<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminMultiDeviceAuthTest extends TestCase
{
    protected array $createdUserIds = [];

    protected function tearDown(): void
    {
        if (!empty($this->createdUserIds)) {
            User::whereIn('id', $this->createdUserIds)->delete();
        }
        parent::tearDown();
    }

    protected function createTestUser(array $attributes = []): User
    {
        $unique = bin2hex(random_bytes(6));
        $user = User::create(array_merge([
            'name' => 'Multi Device User ' . $unique,
            'email' => "auth_test_{$unique}@example.com",
            'password' => Hash::make('Password123!'),
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
            'is_active' => true,
            'must_change_password' => false,
            'permissions' => [],
        ], $attributes));

        $this->createdUserIds[] = $user->id;
        return $user;
    }

    public function test_admin_can_stay_logged_in_on_multiple_devices_concurrently(): void
    {
        $admin = $this->createTestUser([
            'email' => 'admin_multi_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        // Device 1: Login
        $loginRes1 = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);

        $loginRes1->assertStatus(200)
            ->assertJsonPath('success', true);
        $token1 = $loginRes1->json('data.token');
        $this->assertNotEmpty($token1);

        // Device 2: Login with same admin credentials
        $loginRes2 = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);

        $loginRes2->assertStatus(200)
            ->assertJsonPath('success', true);
        $token2 = $loginRes2->json('data.token');
        $this->assertNotEmpty($token2);
        $this->assertNotEquals($token1, $token2);

        // Verify in database that BOTH tokens exist for the admin user
        $this->assertEquals(2, $admin->tokens()->count());

        // Device 1 makes authenticated request to /auth/me - must SUCCEED (200)
        $meRes1 = $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/auth/me');
        $meRes1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $admin->id);

        // Device 2 makes authenticated request to /auth/me - must SUCCEED (200)
        $meRes2 = $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/auth/me');
        $meRes2->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $admin->id);

        // Both devices can also access admin-protected routes
        $adminRes1 = $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/admin/categories');
        $adminRes1->assertStatus(200);

        $adminRes2 = $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/admin/categories');
        $adminRes2->assertStatus(200);
    }

    public function test_logging_out_on_one_device_only_logs_out_that_device_for_admin(): void
    {
        $admin = $this->createTestUser([
            'email' => 'admin_logout_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        // Device 1: Login
        $loginRes1 = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);
        $token1 = $loginRes1->json('data.token');

        // Device 2: Login
        $loginRes2 = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);
        $token2 = $loginRes2->json('data.token');

        // Device 2 logs out
        $this->assertEquals(2, $admin->tokens()->count());

        $logoutRes = $this->withHeader('Authorization', "Bearer {$token2}")
            ->postJson('/api/v1/auth/logout');
        $logoutRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify token count dropped to 1 in DB
        $this->assertEquals(1, $admin->tokens()->count());

        // In Laravel test cases within the same process, reset auth guard cache
        auth()->forgetGuards();

        // Device 2 is now logged out (token2 invalid)
        $meRes2 = $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/auth/me');
        $meRes2->assertStatus(401);

        // Device 1 is STILL valid and logged in!
        $meRes1 = $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/auth/me');
        $meRes1->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $admin->id);
    }

    public function test_customer_login_still_revokes_previous_token_maintaining_single_session(): void
    {
        $customer = $this->createTestUser([
            'email' => 'customer_single_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_CUSTOMER,
            'is_super_admin' => false,
        ]);

        // Device 1: Customer login
        $loginRes1 = $this->postJson('/api/v1/auth/login', [
            'email' => $customer->email,
            'password' => 'Password123!',
        ]);
        $token1 = $loginRes1->json('data.token');
        $this->assertNotEmpty($token1);

        // Device 2: Customer logs in on second browser
        $loginRes2 = $this->postJson('/api/v1/auth/login', [
            'email' => $customer->email,
            'password' => 'Password123!',
        ]);
        $token2 = $loginRes2->json('data.token');
        $this->assertNotEmpty($token2);

        // For customer: token1 should be deleted (single-session enforced)
        $this->assertEquals(1, $customer->tokens()->count());

        // Device 1 token should now be UNAUTHORIZED (401)
        $meRes1 = $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/auth/me');
        $meRes1->assertStatus(401);

        // Device 2 token should be AUTHORIZED (200)
        $meRes2 = $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/auth/me');
        $meRes2->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $customer->id);
    }

    public function test_staff_admin_can_also_stay_logged_in_on_multiple_devices(): void
    {
        $staff = $this->createTestUser([
            'email' => 'staff_multi_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_STAFF,
            'is_super_admin' => false,
            'permissions' => ['orders', 'categories'],
        ]);

        // Device 1
        $res1 = $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email,
            'password' => 'Password123!',
        ]);
        $res1->assertStatus(200);
        $token1 = $res1->json('data.token');

        // Device 2
        $res2 = $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email,
            'password' => 'Password123!',
        ]);
        $res2->assertStatus(200);
        $token2 = $res2->json('data.token');

        $this->assertEquals(2, $staff->tokens()->count());

        // Both devices can access permitted endpoints
        $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/admin/categories')
            ->assertStatus(200);

        $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/admin/categories')
            ->assertStatus(200);
    }

    public function test_client_brief_admin_allows_multi_device_login(): void
    {
        $admin = $this->createTestUser([
            'email' => 'brief_admin_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        // Device 1
        $res1 = $this->postJson('/api/v1/client-brief-auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);
        $res1->assertStatus(200);
        $token1 = $res1->json('data.token');

        // Device 2
        $res2 = $this->postJson('/api/v1/client-brief-auth/login', [
            'email' => $admin->email,
            'password' => 'Password123!',
        ]);
        $res2->assertStatus(200);
        $token2 = $res2->json('data.token');

        $this->assertEquals(2, $admin->tokens()->where('name', 'client-brief-admin')->count());

        // Device 1 and Device 2 can access /client-brief-auth/me
        $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/client-brief-auth/me')
            ->assertStatus(200);

        auth()->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/client-brief-auth/me')
            ->assertStatus(200);

        auth()->forgetGuards();

        // Device 2 logs out
        $this->withHeader('Authorization', "Bearer {$token2}")
            ->postJson('/api/v1/client-brief-auth/logout')
            ->assertStatus(200);

        $this->assertEquals(1, $admin->tokens()->where('name', 'client-brief-admin')->count());

        auth()->forgetGuards();

        // Device 2 is logged out
        $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/client-brief-auth/me')
            ->assertStatus(401);

        auth()->forgetGuards();

        // Device 1 is STILL logged in
        $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/client-brief-auth/me')
            ->assertStatus(200);
    }

    public function test_deactivating_admin_or_staff_revokes_all_device_tokens(): void
    {
        $superAdmin = $this->createTestUser([
            'email' => 'super_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        $staff = $this->createTestUser([
            'email' => 'staff_deact_' . bin2hex(random_bytes(4)) . '@example.com',
            'role' => User::ROLE_STAFF,
            'is_active' => true,
            'permissions' => ['orders'],
        ]);

        // Staff logs in on 2 devices
        $token1 = $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email,
            'password' => 'Password123!',
        ])->json('data.token');

        $token2 = $this->postJson('/api/v1/auth/login', [
            'email' => $staff->email,
            'password' => 'Password123!',
        ])->json('data.token');

        $this->assertEquals(2, $staff->tokens()->count());

        // Super Admin deactivates staff
        $deactRes = $this->actingAs($superAdmin, 'sanctum')
            ->patchJson("/api/v1/admin/staff/{$staff->id}/toggle-active");
        $deactRes->assertStatus(200);

        auth()->forgetGuards();

        // All tokens are revoked
        $this->assertEquals(0, $staff->tokens()->count());

        $this->withHeader('Authorization', "Bearer {$token1}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        $this->withHeader('Authorization', "Bearer {$token2}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }
}
