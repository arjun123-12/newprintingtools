<?php

namespace Tests\Feature;

use App\Models\RolePreset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminStaffPermissionsTest extends TestCase
{
    // Note: We avoid RefreshDatabase here so we do NOT drop or delete user's existing DB tables or data.
    // We isolate tests by generating unique emails and cleaning up created test models in tearDown.

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
            'name' => 'Test User ' . $unique,
            'email' => "test_{$unique}@example.com",
            'password' => Hash::make('Password123!'),
            'role' => User::ROLE_STAFF,
            'is_super_admin' => false,
            'is_active' => true,
            'must_change_password' => false,
            'permissions' => [],
        ], $attributes));

        $this->createdUserIds[] = $user->id;
        return $user;
    }

    public function test_super_admin_can_access_staff_management(): void
    {
        $superAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/v1/admin/staff');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_non_super_admin_cannot_access_staff_management(): void
    {
        $staff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'is_super_admin' => false,
            'permissions' => ['products', 'orders'],
        ]);

        $response = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/admin/staff');

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_super_admin_can_create_staff_with_customized_preset_permissions(): void
    {
        $superAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        $newStaffEmail = 'designer_' . bin2hex(random_bytes(4)) . '@example.com';

        $payload = [
            'name' => 'Graphic Designer',
            'email' => $newStaffEmail,
            'password' => 'DesignerSecret2026!',
            'role_preset' => 'designer',
            // Designer preset default has ['templates', 'design_assets', 'artwork']
            // Customized by Super Admin to also include 'products':
            'permissions' => ['templates', 'design_assets', 'artwork', 'products'],
            'is_super_admin' => false,
            'must_change_password' => true,
        ];

        $response = $this->actingAs($superAdmin, 'sanctum')
            ->postJson('/api/v1/admin/staff', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', User::ROLE_STAFF)
            ->assertJsonPath('data.is_super_admin', false)
            ->assertJsonPath('data.must_change_password', true);

        $createdId = $response->json('data.id');
        $this->createdUserIds[] = $createdId;

        $createdUser = User::find($createdId);
        $this->assertNotNull($createdUser);
        $this->assertTrue(Hash::check('DesignerSecret2026!', $createdUser->password));
        $this->assertContains('products', $createdUser->permissions);
        $this->assertContains('templates', $createdUser->permissions);
    }

    public function test_staff_permissions_control_backend_access_allowed_and_denied(): void
    {
        // Staff user with ONLY 'orders' permission
        $orderStaff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'is_super_admin' => false,
            'permissions' => ['orders'],
        ]);

        // 1. Should be allowed to access Orders
        $allowedResponse = $this->actingAs($orderStaff, 'sanctum')
            ->getJson('/api/v1/admin/orders');
        $allowedResponse->assertStatus(200);

        // 2. Should be DENIED from accessing Products
        $deniedProducts = $this->actingAs($orderStaff, 'sanctum')
            ->getJson('/api/v1/admin/products');
        $deniedProducts->assertStatus(403)
            ->assertJsonPath('success', false);

        // 3. Should be DENIED from accessing Categories
        $deniedCategories = $this->actingAs($orderStaff, 'sanctum')
            ->getJson('/api/v1/admin/categories');
        $deniedCategories->assertStatus(403)
            ->assertJsonPath('success', false);

        // 4. Should be DENIED from accessing Invoices
        $deniedInvoices = $this->actingAs($orderStaff, 'sanctum')
            ->getJson('/api/v1/admin/invoices');
        $deniedInvoices->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_last_active_super_admin_cannot_be_deactivated_or_deleted(): void
    {
        // Find how many active super admins currently exist
        $activeSuperAdmins = User::where('is_super_admin', true)->where('is_active', true)->get();

        // If more than 1, keep only 1 for this test, or test protection when count is 1
        $soleSuperAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
            'is_active' => true,
        ]);

        // Temporarily mark any other super admins as is_super_admin = false to test the boundary
        $otherSuperAdminIds = User::where('is_super_admin', true)
            ->where('id', '!=', $soleSuperAdmin->id)
            ->pluck('id');

        User::whereIn('id', $otherSuperAdminIds)->update(['is_super_admin' => false]);

        try {
            // Attempting to deactivate sole super admin must fail
            $toggleResponse = $this->actingAs($soleSuperAdmin, 'sanctum')
                ->patchJson("/api/v1/admin/staff/{$soleSuperAdmin->id}/toggle-active");

            $toggleResponse->assertStatus(422)
                ->assertJsonPath('success', false);

            // Attempting to delete sole super admin must fail
            $deleteResponse = $this->actingAs($soleSuperAdmin, 'sanctum')
                ->deleteJson("/api/v1/admin/staff/{$soleSuperAdmin->id}");

            $deleteResponse->assertStatus(422)
                ->assertJsonPath('success', false);
        } finally {
            // Restore other super admins
            User::whereIn('id', $otherSuperAdminIds)->update(['is_super_admin' => true]);
        }
    }

    public function test_deactivated_user_cannot_login_or_access_admin_api(): void
    {
        $inactiveStaff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'is_active' => false,
            'permissions' => ['products', 'orders'],
        ]);

        // Login attempt must be rejected with 403
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => $inactiveStaff->email,
            'password' => 'Password123!',
        ]);

        $loginResponse->assertStatus(403)
            ->assertJsonPath('success', false);

        // API attempt with valid token must also be rejected
        $apiResponse = $this->actingAs($inactiveStaff, 'sanctum')
            ->getJson('/api/v1/admin/orders');

        $apiResponse->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_password_change_flow(): void
    {
        $staff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'must_change_password' => true,
        ]);

        // Attempt change with wrong current password
        $wrongCurrent = $this->actingAs($staff, 'sanctum')
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'WrongPassword!',
                'password' => 'NewSecurePassword2026!',
                'password_confirmation' => 'NewSecurePassword2026!',
            ]);
        $wrongCurrent->assertStatus(422);

        // Change with correct current password
        $validChange = $this->actingAs($staff, 'sanctum')
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'Password123!',
                'password' => 'NewSecurePassword2026!',
                'password_confirmation' => 'NewSecurePassword2026!',
            ]);

        $validChange->assertStatus(200)
            ->assertJsonPath('success', true);

        $staff->refresh();
        $this->assertFalse((bool) $staff->must_change_password);
        $this->assertTrue(Hash::check('NewSecurePassword2026!', $staff->password));
    }

    public function test_audit_log_records_staff_creation_update_deactivation_without_secrets(): void
    {
        $superAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        $staffEmail = 'audit_tester_' . bin2hex(random_bytes(4)) . '@example.com';

        // 1. Create staff
        $createRes = $this->actingAs($superAdmin, 'sanctum')
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Audit Test User',
                'email' => $staffEmail,
                'password' => 'InitialSecret2026!',
                'role_preset' => 'designer',
                'permissions' => ['templates', 'artwork'],
            ]);
        $createRes->assertStatus(201);
        $staffId = $createRes->json('data.id');
        $this->createdUserIds[] = $staffId;

        // Verify creation audit log
        $createLog = \App\Models\StaffAuditLog::where('action', 'staff_created')
            ->where('affected_user_email', $staffEmail)
            ->first();

        $this->assertNotNull($createLog);
        $this->assertEquals($superAdmin->id, $createLog->actor_id);
        // Ensure no passwords or secrets were logged!
        $this->assertArrayNotHasKey('password', (array) $createLog->details);
        $this->assertArrayNotHasKey('token', (array) $createLog->details);

        // 2. Update staff permissions
        $updateRes = $this->actingAs($superAdmin, 'sanctum')
            ->putJson("/api/v1/admin/staff/{$staffId}", [
                'name' => 'Audit Test User Updated',
                'email' => $staffEmail,
                'password' => 'NewPassword2026!',
                'permissions' => ['templates', 'artwork', 'orders'],
            ]);
        $updateRes->assertStatus(200);

        // Verify update audit log
        $updateLog = \App\Models\StaffAuditLog::where('action', 'staff_updated')
            ->where('affected_user_id', $staffId)
            ->first();

        $this->assertNotNull($updateLog);
        $this->assertArrayNotHasKey('password', (array) $updateLog->details);
        $this->assertContains('orders', $updateLog->details['permissions_added'] ?? []);

        // 3. Deactivate staff
        $deactivateRes = $this->actingAs($superAdmin, 'sanctum')
            ->patchJson("/api/v1/admin/staff/{$staffId}/toggle-active");
        $deactivateRes->assertStatus(200);

        // Verify deactivation audit log
        $deactivateLog = \App\Models\StaffAuditLog::where('action', 'staff_deactivated')
            ->where('affected_user_id', $staffId)
            ->first();

        $this->assertNotNull($deactivateLog);
        $this->assertFalse($deactivateLog->details['is_active']);

        // 4. Verify Super Admin can view audit logs API
        $logsRes = $this->actingAs($superAdmin, 'sanctum')
            ->getJson('/api/v1/admin/staff/audit-logs');

        $logsRes->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_deactivating_user_revokes_active_tokens_and_sessions(): void
    {
        $superAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        $staff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'is_active' => true,
            'permissions' => ['orders'],
        ]);

        // Issue tokens for this staff user
        $staff->createToken('session-1', ['orders']);
        $staff->createToken('session-2', ['orders']);
        $this->assertEquals(2, $staff->tokens()->count());

        // Deactivate staff
        $response = $this->actingAs($superAdmin, 'sanctum')
            ->patchJson("/api/v1/admin/staff/{$staff->id}/toggle-active");
        $response->assertStatus(200);

        // Verify all tokens were immediately revoked
        $this->assertEquals(0, $staff->tokens()->count());
    }

    public function test_custom_role_presets_crud_and_preservation_of_existing_user_permissions(): void
    {
        $superAdmin = $this->createTestUser([
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => true,
        ]);

        // 1. Create a custom preset
        $presetRes = $this->actingAs($superAdmin, 'sanctum')
            ->postJson('/api/v1/admin/staff/presets', [
                'name' => 'Catalog Assistant',
                'description' => 'Help with products and categories',
                'permissions' => ['products', 'categories'],
            ]);

        $presetRes->assertStatus(201)
            ->assertJsonPath('data.name', 'Catalog Assistant')
            ->assertJsonPath('data.is_system', false);

        $presetId = $presetRes->json('data.id');

        // 2. Assign staff user with this custom preset
        $staffEmail = 'assistant_' . bin2hex(random_bytes(4)) . '@example.com';
        $staffRes = $this->actingAs($superAdmin, 'sanctum')
            ->postJson('/api/v1/admin/staff', [
                'name' => 'Catalog Staff',
                'email' => $staffEmail,
                'password' => 'Password123!',
                'role_preset' => 'catalog-assistant',
                'permissions' => ['products', 'categories'],
            ]);
        $staffRes->assertStatus(201);
        $staffId = $staffRes->json('data.id');
        $this->createdUserIds[] = $staffId;

        // 3. Super Admin edits the preset later to add 'pricing'
        $updatePresetRes = $this->actingAs($superAdmin, 'sanctum')
            ->putJson("/api/v1/admin/staff/presets/{$presetId}", [
                'name' => 'Catalog Assistant Senior',
                'description' => 'Added pricing authority',
                'permissions' => ['products', 'categories', 'pricing'],
            ]);
        $updatePresetRes->assertStatus(200);

        // 4. CRITICAL: Verify existing user's permissions were NOT silently changed!
        $existingStaff = User::find($staffId);
        $this->assertEquals(['products', 'categories'], $existingStaff->permissions);
        $this->assertFalse($existingStaff->hasPermission('pricing'));

        // 5. Delete custom preset
        $deletePresetRes = $this->actingAs($superAdmin, 'sanctum')
            ->deleteJson("/api/v1/admin/staff/presets/{$presetId}");
        $deletePresetRes->assertStatus(200);

        // 6. Attempting to delete a system preset must fail
        $systemPreset = RolePreset::where('is_system', true)->first();
        if ($systemPreset) {
            $failDelete = $this->actingAs($superAdmin, 'sanctum')
                ->deleteJson("/api/v1/admin/staff/presets/{$systemPreset->id}");
            $failDelete->assertStatus(422);
        }
    }

    public function test_non_super_admin_cannot_access_audit_logs(): void
    {
        $staff = $this->createTestUser([
            'role' => User::ROLE_STAFF,
            'is_super_admin' => false,
        ]);

        $response = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/admin/staff/audit-logs');

        $response->assertStatus(403);
    }
}
