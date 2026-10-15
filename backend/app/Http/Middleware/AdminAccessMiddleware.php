<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAccessMiddleware
{
    /**
     * Handle an incoming request.
     * Ensures user is authenticated, active, and authorized to access the admin area.
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

        if (!$user->canAccessAdminPanel()) {
            return response()->json([
                'success' => false,
                'message' => 'Administrator access required.',
            ], 403);
        }

        return $next($request);
    }
}
