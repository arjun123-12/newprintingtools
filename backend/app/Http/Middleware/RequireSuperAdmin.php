<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSuperAdmin
{
    /**
     * Handle an incoming request.
     * Restricts access strictly to active Super Administrators.
     */
    public function handle(Request $request, Closure $next): Response
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

        if (!$user->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Only Super Administrators can manage staff users and permissions.',
            ], 403);
        }

        return $next($request);
    }
}
