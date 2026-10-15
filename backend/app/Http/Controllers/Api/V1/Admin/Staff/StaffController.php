<?php

namespace App\Http\Controllers\Api\V1\Admin\Staff;

use App\Http\Controllers\Controller;
use App\Models\RolePreset;
use App\Models\StaffAuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    /**
     * List all staff and administrator accounts.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where(function ($q) {
                $q->where('is_super_admin', true)
                  ->orWhere('role', User::ROLE_ADMIN)
                  ->orWhere('role', User::ROLE_STAFF);
            });

        // Search by name or email
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filter by active/inactive status
        $status = $request->query('status');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // Filter by preset
        if ($preset = $request->query('preset')) {
            $query->where('role_preset', $preset);
        }

        $users = $query->orderBy('name', 'asc')->get();

        $formatted = $users->map(fn (User $user) => $this->formatUser($user));

        return response()->json([
            'success' => true,
            'data' => $formatted,
            'meta' => [
                'total' => $formatted->count(),
                'active' => $users->where('is_active', true)->count(),
                'super_admins' => $users->where('is_super_admin', true)->count(),
            ],
        ]);
    }

    /**
     * Return available role presets.
     */
    public function presets(): JsonResponse
    {
        $presets = RolePreset::orderBy('id', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $presets,
        ]);
    }

    /**
     * Create a new custom role preset.
     */
    public function storePreset(Request $request): JsonResponse
    {
        $validKeys = array_keys(User::PERMISSIONS);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', Rule::in($validKeys)],
        ]);

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 1;
        while (RolePreset::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $preset = RolePreset::create([
            'name' => trim($validated['name']),
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'permissions' => array_values(array_unique($validated['permissions'])),
            'is_system' => false,
        ]);

        $this->logAudit($request, 'preset_created', null, [
            'preset_id' => $preset->id,
            'preset_name' => $preset->name,
            'permissions' => $preset->permissions,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role preset created successfully.',
            'data' => $preset,
        ], 201);
    }

    /**
     * Update an existing custom role preset.
     * Note: Changing a preset does NOT silently alter permissions already assigned to existing users.
     */
    public function updatePreset(Request $request, int $id): JsonResponse
    {
        $preset = RolePreset::findOrFail($id);
        $validKeys = array_keys(User::PERMISSIONS);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', Rule::in($validKeys)],
        ]);

        $oldPermissions = $preset->permissions;

        $preset->name = trim($validated['name']);
        if (array_key_exists('description', $validated)) {
            $preset->description = $validated['description'];
        }
        $preset->permissions = array_values(array_unique($validated['permissions']));
        $preset->save();

        $this->logAudit($request, 'preset_updated', null, [
            'preset_id' => $preset->id,
            'preset_name' => $preset->name,
            'permissions_before' => $oldPermissions,
            'permissions_after' => $preset->permissions,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role preset updated successfully.',
            'data' => $preset,
        ]);
    }

    /**
     * Delete a custom role preset.
     */
    public function destroyPreset(Request $request, int $id): JsonResponse
    {
        $preset = RolePreset::findOrFail($id);

        if ($preset->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'Action prohibited: Built-in system presets cannot be deleted.',
            ], 422);
        }

        $presetName = $preset->name;
        $preset->delete();

        $this->logAudit($request, 'preset_deleted', null, [
            'preset_id' => $id,
            'preset_name' => $presetName,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role preset deleted successfully.',
        ]);
    }

    /**
     * Return canonical list of permissions.
     */
    public function permissionsList(): JsonResponse
    {
        $permissions = [];
        foreach (User::PERMISSIONS as $key => $meta) {
            $permissions[] = [
                'key' => $key,
                'name' => $meta['name'],
                'description' => $meta['description'],
                'category' => $meta['category'],
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $permissions,
        ]);
    }

    /**
     * Create a new staff account.
     */
    public function store(Request $request): JsonResponse
    {
        $validKeys = array_keys(User::PERMISSIONS);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'role_preset' => ['nullable', 'string', 'max:50'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in($validKeys)],
            'is_super_admin' => ['nullable', 'boolean'],
            'must_change_password' => ['nullable', 'boolean'],
        ]);

        $isSuperAdmin = (bool) ($validated['is_super_admin'] ?? false);

        // Sanitize permissions
        $permissions = $isSuperAdmin
            ? $validKeys
            : array_values(array_unique($validated['permissions'] ?? []));

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower(trim($validated['email'])),
            'phone' => $validated['phone'] ?? null,
            'role' => $isSuperAdmin ? User::ROLE_ADMIN : User::ROLE_STAFF,
            'is_super_admin' => $isSuperAdmin,
            'is_active' => true,
            'permissions' => $permissions,
            'role_preset' => $validated['role_preset'] ?? null,
            'must_change_password' => $request->has('must_change_password')
                ? (bool) $validated['must_change_password']
                : true, // Default to true so newly created staff must change password on first login
            'password' => Hash::make($validated['password']),
        ]);

        // Audit Log: staff_created
        $this->logAudit($request, 'staff_created', $user, [
            'is_super_admin' => $user->is_super_admin,
            'role_preset' => $user->role_preset,
            'permissions' => $user->permissions,
            'must_change_password' => $user->must_change_password,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Staff user created successfully.',
            'data' => $this->formatUser($user),
        ], 201);
    }

    /**
     * Show a single staff user.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Update an existing staff account.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $validKeys = array_keys(User::PERMISSIONS);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'role_preset' => ['nullable', 'string', 'max:50'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in($validKeys)],
            'is_super_admin' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'must_change_password' => ['nullable', 'boolean'],
        ]);

        $targetSuperAdmin = $request->has('is_super_admin')
            ? (bool) $validated['is_super_admin']
            : (bool) $user->is_super_admin;

        $targetActive = $request->has('is_active')
            ? (bool) $validated['is_active']
            : (bool) $user->is_active;

        // CRITICAL PROTECTION: The last Super Admin cannot be deactivated or demoted
        if ($user->isSuperAdmin() && $user->is_active) {
            if (!$targetSuperAdmin || !$targetActive) {
                $otherActiveSuperAdmins = User::where('is_super_admin', true)
                    ->where('is_active', true)
                    ->where('id', '!=', $user->id)
                    ->count();

                if ($otherActiveSuperAdmins === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Action prohibited: The last active Super Administrator cannot be deactivated or demoted.',
                    ], 422);
                }
            }
        }

        // Capture previous state for audit log diff
        $prevPermissions = $user->getEffectivePermissions();
        $prevActive = (bool) $user->is_active;
        $prevSuperAdmin = (bool) $user->is_super_admin;
        $prevPreset = $user->role_preset;

        // Apply changes
        $user->name = $validated['name'];
        $user->email = strtolower(trim($validated['email']));
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }
        if (array_key_exists('role_preset', $validated)) {
            $user->role_preset = $validated['role_preset'];
        }
        if ($request->has('is_super_admin')) {
            $user->is_super_admin = $targetSuperAdmin;
            $user->role = $targetSuperAdmin ? User::ROLE_ADMIN : User::ROLE_STAFF;
        }
        if ($request->has('is_active')) {
            $user->is_active = $targetActive;
        }
        if ($request->has('must_change_password')) {
            $user->must_change_password = (bool) $validated['must_change_password'];
        }

        // Permissions: If Super Admin, grant all; otherwise save specific selection
        if ($targetSuperAdmin) {
            $user->permissions = $validKeys;
        } elseif ($request->has('permissions')) {
            $user->permissions = array_values(array_unique($validated['permissions'] ?? []));
        }

        $passwordUpdated = false;
        // Update password if provided
        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
            $passwordUpdated = true;
        }

        $user->save();

        // If user was just deactivated, immediately revoke all their active tokens and sessions
        if ($prevActive && !$user->is_active) {
            $this->revokeUserSessionsAndTokens($user);
        }

        // Audit Log: staff_updated
        $newPermissions = $user->getEffectivePermissions();
        $this->logAudit($request, 'staff_updated', $user, [
            'permissions_added' => array_values(array_diff($newPermissions, $prevPermissions)),
            'permissions_removed' => array_values(array_diff($prevPermissions, $newPermissions)),
            'super_admin_changed' => $prevSuperAdmin !== (bool) $user->is_super_admin ? ['from' => $prevSuperAdmin, 'to' => (bool) $user->is_super_admin] : null,
            'status_changed' => $prevActive !== (bool) $user->is_active ? ['from' => $prevActive, 'to' => (bool) $user->is_active] : null,
            'preset_changed' => $prevPreset !== $user->role_preset ? ['from' => $prevPreset, 'to' => $user->role_preset] : null,
            'password_reset' => $passwordUpdated,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Staff user updated successfully.',
            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Toggle active/inactive status for a staff user.
     * When deactivated, immediately revokes active tokens and database sessions.
     */
    public function toggleActive(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        // If currently active and is super admin, check if last super admin
        if ($user->is_active && $user->isSuperAdmin()) {
            $otherActiveSuperAdmins = User::where('is_super_admin', true)
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Action prohibited: The last active Super Administrator cannot be deactivated.',
                ], 422);
            }
        }

        $newActiveState = !$user->is_active;
        $user->is_active = $newActiveState;
        $user->save();

        // Revoke active sessions and API tokens immediately upon deactivation
        if (!$newActiveState) {
            $this->revokeUserSessionsAndTokens($user);
        }

        // Audit Log: staff_deactivated / staff_activated
        $action = $newActiveState ? 'staff_activated' : 'staff_deactivated';
        $this->logAudit($request, $action, $user, [
            'is_active' => $newActiveState,
            'tokens_revoked' => !$newActiveState,
        ]);

        return response()->json([
            'success' => true,
            'message' => $user->is_active ? 'Staff user activated.' : 'Staff user deactivated and active sessions revoked.',
            'data' => [
                'id' => $user->id,
                'is_active' => (bool) $user->is_active,
            ],
        ]);
    }

    /**
     * Delete a staff user.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($request->user() && $request->user()->id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Action prohibited: You cannot delete your own account.',
            ], 422);
        }

        if ($user->isSuperAdmin() && $user->is_active) {
            $otherActiveSuperAdmins = User::where('is_super_admin', true)
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Action prohibited: The last active Super Administrator cannot be removed.',
                ], 422);
            }
        }

        $deletedDetails = [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'is_super_admin' => $user->is_super_admin,
        ];

        // Invalidate active tokens & sessions
        $this->revokeUserSessionsAndTokens($user);
        $user->delete();

        // Audit Log: staff_deleted
        $this->logAudit($request, 'staff_deleted', null, $deletedDetails);

        return response()->json([
            'success' => true,
            'message' => 'Staff user removed successfully.',
        ]);
    }

    /**
     * Return chronological audit logs for Super Admins.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $query = StaffAuditLog::query()->orderBy('created_at', 'desc');

        if ($action = $request->query('action')) {
            $query->where('action', $action);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('actor_name', 'like', "%{$search}%")
                  ->orWhere('actor_email', 'like', "%{$search}%")
                  ->orWhere('affected_user_name', 'like', "%{$search}%")
                  ->orWhere('affected_user_email', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%");
            });
        }

        $limit = min((int) ($request->query('limit', 50)), 100);
        $logs = $query->limit($limit)->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    /**
     * Revoke all active API tokens and database sessions for a user.
     */
    protected function revokeUserSessionsAndTokens(User $user): void
    {
        // 1. Delete all personal access tokens
        $user->tokens()->delete();

        // 2. Clear database sessions if sessions table exists
        if (Schema::hasTable('sessions')) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }
    }

    /**
     * Log an administrative security action to the audit log.
     * Never records passwords, plain tokens, or secrets.
     */
    protected function logAudit(
        Request $request,
        string $action,
        ?User $affectedUser = null,
        array $details = []
    ): void {
        $actor = $request->user();

        // Strip any sensitive attributes
        $cleanDetails = array_diff_key($details, array_flip([
            'password',
            'current_password',
            'password_confirmation',
            'token',
            'plainTextToken',
            'remember_token',
        ]));

        StaffAuditLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'System',
            'actor_email' => $actor?->email ?? 'system@printecommerce.com.au',
            'affected_user_id' => $affectedUser?->id,
            'affected_user_name' => $affectedUser?->name ?? ($details['affected_user_name'] ?? null),
            'affected_user_email' => $affectedUser?->email ?? ($details['affected_user_email'] ?? null),
            'action' => $action,
            'details' => $cleanDetails,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
        ]);
    }

    /**
     * Format user resource safely (never exposes passwords or hashes).
     */
    protected function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'is_super_admin' => (bool) $user->is_super_admin,
            'is_active' => (bool) $user->is_active,
            'role_preset' => $user->role_preset,
            'permissions' => $user->getEffectivePermissions(),
            'must_change_password' => (bool) $user->must_change_password,
            'created_at' => $user->created_at?->toIso8601String(),
            'updated_at' => $user->updated_at?->toIso8601String(),
        ];
    }
}
