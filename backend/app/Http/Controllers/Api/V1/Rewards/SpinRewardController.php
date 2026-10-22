<?php

namespace App\Http\Controllers\Api\V1\Rewards;

use App\Http\Controllers\Controller;
use App\Services\Rewards\SpinRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class SpinRewardController extends Controller
{
    public function __construct(
        protected SpinRewardService $spinRewardService
    ) {}

    /**
     * Get eligibility and wheel segments for an order.
     * Only orders where payment is verified are eligible.
     */
    public function checkEligibility(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => ['required', 'string', 'max:64'],
        ]);

        try {
            $result = $this->spinRewardService->getEligibility(
                $validated['order_number'],
                $request->user()
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'Unable to evaluate Spin & Win eligibility: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Securely execute a spin on the backend before the client animation starts.
     * Returns target slice index and prize details.
     */
    public function spin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => ['required', 'string', 'max:64'],
            'spin_token' => ['required', 'string', 'max:64'],
        ]);

        try {
            $result = $this->spinRewardService->executeSpin(
                $validated['order_number'],
                $validated['spin_token'],
                $request->user(),
                $request->ip()
            );

            return response()->json([
                'success' => true,
                'message' => 'Reward selected successfully.',
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Unable to process reward spin.',
            ], 422);
        }
    }

    /**
     * Get all won rewards for the authenticated customer account.
     */
    public function customerRewards(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            $data = $this->spinRewardService->getCustomerRewards($user);

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'Unable to load customer rewards.',
            ], 500);
        }
    }

    /**
     * Validate a reward code for redemption on a future order.
     */
    public function validateReward(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'subtotal' => ['nullable', 'numeric', 'min:0'],
        ]);

        try {
            $result = $this->spinRewardService->validateRewardForCheckout(
                $validated['code'],
                (float) ($validated['subtotal'] ?? 0),
                $request->user()
            );

            return response()->json([
                'success' => $result['valid'] ?? false,
                'data' => $result,
            ], ($result['valid'] ?? false) ? 200 : 422);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to validate voucher code.',
            ], 500);
        }
    }
}
