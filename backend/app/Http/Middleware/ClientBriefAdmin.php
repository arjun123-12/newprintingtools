<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ClientBriefAdmin
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        if ($user->role !== 'client_brief_admin') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Client Brief access is not permitted.',
            ], 403);
        }

        return $next($request);
    }
}