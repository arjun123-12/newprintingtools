<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(
        protected \App\Services\Cart\CartService $cartService
    ) {}

    /**
     * Log in an existing user and create a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email or password is incorrect.',
            ], 401);
        }

        /*
         * Admin receives template permissions.
         * Customer receives only customer access.
         */
        if ($user->isAdmin()) {
            $tokenName = 'admin-panel';

            $abilities = [
                'templates:create',
                'templates:read',
                'templates:update',
                'templates:delete',
            ];
        } else {
            $tokenName = 'customer-app';

            $abilities = [
                'customer:access',
            ];
        }

        /*
         * Delete the previous token with the same name.
         * This prevents unused tokens accumulating.
         */
        $user->tokens()
            ->where('name', $tokenName)
            ->delete();

        $token = $user->createToken(
            $tokenName,
            $abilities
        )->plainTextToken;

        // Merge guest cart if session ID was provided
        $sessionId = $request->header('X-Session-ID') ?? $request->input('session_id');
        if (!empty($sessionId)) {
            $this->cartService->getOrCreateCart($sessionId, $user->id);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
                'abilities' => $abilities,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'company_name' => $user->company_name,
                    'role' => $user->role,
                    'is_admin' => $user->isAdmin(),
                ],
            ],
        ]);
    }

    /**
     * Register a new customer account.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'abn' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'company_name' => $validated['company_name'] ?? null,
            'abn' => $validated['abn'] ?? null,
            'role' => User::ROLE_CUSTOMER,
            'password' => Hash::make($validated['password']),
        ]);

        $abilities = [
            'customer:access',
        ];

        $token = $user->createToken(
            'customer-app',
            $abilities
        )->plainTextToken;

        // Merge guest cart if session ID was provided
        $sessionId = $request->header('X-Session-ID') ?? $request->input('session_id');
        if (!empty($sessionId)) {
            $this->cartService->getOrCreateCart($sessionId, $user->id);
        }

        return response()->json([
            'success' => true,
            'message' => 'Account registered successfully.',
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
                'abilities' => $abilities,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'company_name' => $user->company_name,
                    'role' => $user->role,
                    'is_admin' => false,
                ],
            ],
        ], 201);
    }

    /**
     * Return the currently authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company_name' => $user->company_name,
                'abn' => $user->abn,
                'role' => $user->role,
                'is_admin' => $user->isAdmin(),
            ],
        ]);
    }

    /**
     * Delete the current Sanctum token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()
            ?->currentAccessToken()
            ?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }
}