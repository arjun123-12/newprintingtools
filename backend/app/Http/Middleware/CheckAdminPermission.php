<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminPermission
{
    /**
     * Handle an incoming request.
     * Enforces granular section permissions.
     * Super Admins bypass checks.
     * Inactive accounts are blocked.
     * Denies by default.
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        if (!($user->is_active ?? true)) {
            return response()->json([
                'success' => false,
                'message' => 'Your account has been deactivated. Please contact an administrator.',
            ], 403);
        }

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Administrator access required.',
            ], 403);
        }

        // Super Admin retains unrestricted access
        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        // Check if user has ANY of the required permissions
        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Access denied. You do not have permission to access this section.',
            'required_permissions' => $permissions,
        ], 403);
    }
}
