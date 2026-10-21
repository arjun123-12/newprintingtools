<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ClientBriefAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => [
                'required',
                'email',
            ],
            'password' => [
                'required',
                'string',
            ],
        ]);

        $user = User::query()
            ->where(
                'email',
                strtolower($validated['email'])
            )
            ->first();

        if (
            !$user ||
            !Hash::check(
                $validated['password'],
                $user->password
            )
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password.',
            ], 422);
        }

        if (!in_array($user->role, ['client_brief_admin', 'admin'])) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This account does not have Client Brief access.',
            ], 403);
        }

        /*
         * Allow concurrent logins for admin accounts while preserving single-token
         * policy for non-admin accounts.
         */
        if (!$user->canAccessAdminPanel() && $user->role !== 'client_brief_admin') {
            $user->tokens()
                ->where('name', 'client-brief-admin')
                ->delete();
        } else {
            $user->tokens()
                ->where('name', 'client-brief-admin')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<', now())
                ->delete();
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $token = $user
            ->createToken('client-brief-admin')
            ->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',

            'data' => [
                'token' => $token,

                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,

            'data' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'role' => $request->user()->role,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()
            ->currentAccessToken()
            ?->delete();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }
}