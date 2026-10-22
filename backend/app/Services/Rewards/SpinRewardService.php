<?php

namespace App\Services\Rewards;

use App\Enums\PaymentStatus;
use App\Models\CustomerRewardLedger;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderSpinEntitlement;
use App\Models\Payment;
use App\Models\SpinReward;
use App\Models\SpinWinSetting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

class SpinRewardService
{
    /**
     * Get active configured wheel segments formatted for client presentation.
     */
    public function getActiveSegments(): Collection
    {
        return SpinReward::query()
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get()
            ->values()
            ->map(function ($reward, $index) {
                return [
                    'index' => $index,
                    'id' => $reward->id,
                    'code' => $reward->code,
                    'title' => $reward->title,
                    'badge_text' => $reward->badge_text,
                    'reward_type' => $reward->reward_type,
                    'value' => (float) $reward->value,
                    'terms_text' => $reward->terms_text,
                    'how_to_use' => $reward->how_to_use,
                    'color_bg' => $reward->color_bg,
                    'color_text' => $reward->color_text,
                    'icon' => $reward->icon,
                ];
            });
    }

    /**
     * Check if a specific order qualifies for a spin and return entitlement state.
     */
    public function getEligibility(string $orderNumber, ?User $user = null): array
    {
        $enabled = (bool) SpinWinSetting::get('enabled', true);
        if (! $enabled) {
            return [
                'eligible' => false,
                'reason' => 'The Spin & Win reward promotion is currently not active.',
            ];
        }

        $order = Order::query()
            ->where('order_number', $orderNumber)
            ->first();

        if (! $order) {
            return [
                'eligible' => false,
                'reason' => 'Order not found.',
            ];
        }

        // Strict security requirement: Backend verification of payment status
        $isPaid = $order->payment_status === PaymentStatus::PAID
            || ($order->payment_status->value ?? null) === 'paid'
            || Payment::where('order_id', $order->id)->where('status', 'succeeded')->exists();

        if (! $isPaid) {
            return [
                'eligible' => false,
                'reason' => 'Payment has not been completed or verified for this order. Spins are granted only after successful payment.',
            ];
        }

        // Minimum order spend check
        $minSpend = (float) SpinWinSetting::get('min_order_spend', 0.00);
        $orderTotal = (float) ($order->total_inc_gst ?? $order->total);
        if ($minSpend > 0 && $orderTotal < $minSpend) {
            return [
                'eligible' => false,
                'reason' => "This order does not meet the minimum spend requirement of AUD $" . number_format($minSpend, 2) . " for Spin & Win.",
            ];
        }

        $segments = $this->getActiveSegments();

        // Safe entitlement retrieval or creation in atomic transaction
        $entitlement = DB::transaction(function () use ($order, $user) {
            return OrderSpinEntitlement::firstOrCreate(
                ['order_id' => $order->id],
                [
                    'user_id' => $user?->id ?? $order->user_id,
                    'spin_token' => Str::random(48),
                    'status' => 'eligible',
                ]
            );
        });

        // If the order has already spun, return the existing won prize
        if ($entitlement->status === 'spun' || $entitlement->spun_at !== null) {
            $ledger = CustomerRewardLedger::where('entitlement_id', $entitlement->id)->first();

            $segmentIndex = 0;
            if ($ledger) {
                $matched = $segments->firstWhere('id', $ledger->spin_reward_id)
                    ?? $segments->firstWhere('code', $ledger->spinReward?->code);
                $segmentIndex = $matched['index'] ?? 0;
            }

            return [
                'eligible' => true,
                'has_spun' => true,
                'order_number' => $order->order_number,
                'prize' => $ledger ? [
                    'id' => $ledger->id,
                    'reward_code' => $ledger->reward_code,
                    'title' => $ledger->title,
                    'badge_text' => $ledger->badge_text,
                    'reward_type' => $ledger->reward_type,
                    'value' => (float) $ledger->value,
                    'segment_index' => $segmentIndex,
                    'terms_text' => $ledger->terms,
                    'how_to_use' => $ledger->how_to_use,
                    'expires_at' => $ledger->expires_at->toIso8601String(),
                    'status' => $ledger->status,
                    'claim_token' => $ledger->claim_token,
                ] : null,
                'wheel_segments' => $segments,
            ];
        }

        return [
            'eligible' => true,
            'has_spun' => false,
            'order_number' => $order->order_number,
            'spin_token' => $entitlement->spin_token,
            'wheel_segments' => $segments,
            'min_order_spend' => $minSpend,
            'order_total' => $orderTotal,
        ];
    }

    /**
     * Execute server-side prize selection, save in durable ledger, and return target slice index.
     */
    public function executeSpin(string $orderNumber, string $spinToken, ?User $user = null, ?string $clientIp = null): array
    {
        $enabled = (bool) SpinWinSetting::get('enabled', true);
        if (! $enabled) {
            throw new RuntimeException('Spin & Win is currently unavailable.');
        }

        $order = Order::query()->where('order_number', $orderNumber)->first();
        if (! $order) {
            throw new InvalidArgumentException('Order reference is invalid.');
        }

        // Strict backend payment check
        $isPaid = $order->payment_status === PaymentStatus::PAID
            || ($order->payment_status->value ?? null) === 'paid'
            || Payment::where('order_id', $order->id)->where('status', 'succeeded')->exists();

        if (! $isPaid) {
            throw new RuntimeException('Cannot spin. Payment is not confirmed for this order.');
        }

        $segments = $this->getActiveSegments();
        if ($segments->isEmpty()) {
            throw new RuntimeException('No active prize segments configured on the wheel.');
        }

        // Atomic transaction with row lock to prevent race conditions, double clicks, and multiple tabs
        return DB::transaction(function () use ($order, $spinToken, $user, $clientIp, $segments) {
            /** @var OrderSpinEntitlement $entitlement */
            $entitlement = OrderSpinEntitlement::where('order_id', $order->id)
                ->where('spin_token', $spinToken)
                ->lockForUpdate()
                ->first();

            if (! $entitlement) {
                throw new InvalidArgumentException('Invalid spin session or token expired.');
            }

            // Safe idempotency: If already spun, return the existing won prize safely
            if ($entitlement->status === 'spun' || $entitlement->spun_at !== null) {
                $existingLedger = CustomerRewardLedger::where('entitlement_id', $entitlement->id)->first();
                if ($existingLedger) {
                    $matched = $segments->firstWhere('id', $existingLedger->spin_reward_id)
                        ?? $segments->firstWhere('code', $existingLedger->spinReward?->code);
                    $segmentIndex = $matched['index'] ?? 0;

                    return [
                        'success' => true,
                        'already_spun' => true,
                        'prize' => [
                            'id' => $existingLedger->id,
                            'reward_code' => $existingLedger->reward_code,
                            'title' => $existingLedger->title,
                            'badge_text' => $existingLedger->badge_text,
                            'reward_type' => $existingLedger->reward_type,
                            'value' => (float) $existingLedger->value,
                            'segment_index' => $segmentIndex,
                            'terms_text' => $existingLedger->terms,
                            'how_to_use' => $existingLedger->how_to_use,
                            'expires_at' => $existingLedger->expires_at->toIso8601String(),
                            'claim_token' => $existingLedger->claim_token,
                        ],
                    ];
                }
            }

            // Cryptographically secure server-side weighted prize selection
            $orderTotal = (float) ($order->total_inc_gst ?? $order->total);
            $eligibleRewards = SpinReward::query()
                ->where('is_active', true)
                ->where('min_order_spend', '<=', $orderTotal)
                ->orderBy('sort_order', 'asc')
                ->get();

            if ($eligibleRewards->isEmpty()) {
                $eligibleRewards = SpinReward::query()->where('is_active', true)->orderBy('sort_order', 'asc')->get();
            }

            $totalWeight = $eligibleRewards->sum('probability_weight');
            $randomPoint = random_int(1, max(1, $totalWeight));
            $cumulative = 0;
            $selectedReward = $eligibleRewards->first();

            foreach ($eligibleRewards as $reward) {
                $cumulative += $reward->probability_weight;
                if ($randomPoint <= $cumulative) {
                    $selectedReward = $reward;
                    break;
                }
            }

            // Determine target segment index on the wheel
            $matchedSegment = $segments->firstWhere('id', $selectedReward->id);
            $segmentIndex = $matchedSegment['index'] ?? 0;

            // Generate unique, durable reward code (e.g. SPIN-9F2K-7X3M)
            $rewardCode = 'SPIN-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4));
            $claimToken = Str::random(48);

            // Record in durable reward ledger
            $ledger = CustomerRewardLedger::create([
                'entitlement_id' => $entitlement->id,
                'order_id' => $order->id,
                'user_id' => $user?->id ?? $order->user_id,
                'spin_reward_id' => $selectedReward->id,
                'reward_code' => $rewardCode,
                'reward_type' => $selectedReward->reward_type,
                'title' => $selectedReward->title,
                'badge_text' => $selectedReward->badge_text,
                'value' => $selectedReward->value,
                'terms' => $selectedReward->terms_text,
                'how_to_use' => $selectedReward->how_to_use,
                'expires_at' => now()->addDays(max(1, $selectedReward->expiry_days)),
                'status' => 'active',
                'claim_token' => $claimToken,
            ]);

            // Update entitlement record
            $entitlement->update([
                'status' => 'spun',
                'spun_at' => now(),
                'client_ip' => $clientIp,
            ]);

            // Durable audit log in order activities
            OrderActivity::record(
                $order->id,
                'spin_reward_won',
                "Customer spun the Wheel and won: {$selectedReward->title} (Code: {$rewardCode}).",
                'customer',
                null,
                [
                    'reward_id' => $selectedReward->id,
                    'reward_code' => $rewardCode,
                    'reward_type' => $selectedReward->reward_type,
                    'value' => (float) $selectedReward->value,
                ]
            );

            return [
                'success' => true,
                'already_spun' => false,
                'prize' => [
                    'id' => $ledger->id,
                    'reward_code' => $ledger->reward_code,
                    'title' => $ledger->title,
                    'badge_text' => $ledger->badge_text,
                    'reward_type' => $ledger->reward_type,
                    'value' => (float) $ledger->value,
                    'segment_index' => $segmentIndex,
                    'terms_text' => $ledger->terms,
                    'how_to_use' => $ledger->how_to_use,
                    'expires_at' => $ledger->expires_at->toIso8601String(),
                    'claim_token' => $ledger->claim_token,
                ],
            ];
        });
    }

    /**
     * Retrieve all rewards linked to an authenticated customer.
     */
    public function getCustomerRewards(User $user): array
    {
        $ledgers = CustomerRewardLedger::query()
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhereHas('order', fn ($oq) => $oq->where('user_id', $user->id));
            })
            ->with(['order:id,order_number', 'spinReward'])
            ->orderByDesc('created_at')
            ->get();

        $activeCredits = 0.00;
        $formatted = $ledgers->map(function ($l) use (&$activeCredits) {
            $isExpired = $l->isExpired();
            $effectiveStatus = $l->status === 'active' && $isExpired ? 'expired' : $l->status;

            if ($effectiveStatus === 'active' && $l->reward_type === 'print_credit') {
                $activeCredits += (float) $l->value;
            }

            return [
                'id' => $l->id,
                'reward_code' => $l->reward_code,
                'reward_type' => $l->reward_type,
                'title' => $l->title,
                'badge_text' => $l->badge_text,
                'value' => (float) $l->value,
                'terms' => $l->terms,
                'how_to_use' => $l->how_to_use,
                'expires_at' => $l->expires_at->toIso8601String(),
                'status' => $effectiveStatus,
                'order_number' => $l->order?->order_number,
                'created_at' => $l->created_at->toIso8601String(),
            ];
        });

        return [
            'print_bank_balance' => round($activeCredits, 2),
            'rewards_count' => $formatted->count(),
            'active_rewards_count' => $formatted->where('status', 'active')->count(),
            'rewards' => $formatted,
        ];
    }

    /**
     * Validate and preview application of a reward code on future checkout.
     * Note: A reward won after payment applies ONLY to a future eligible order.
     */
    public function validateRewardForCheckout(string $code, float $cartSubtotal, ?User $user = null): array
    {
        $code = strtoupper(trim($code));
        $ledger = CustomerRewardLedger::where('reward_code', $code)->first();

        if (! $ledger) {
            return [
                'valid' => false,
                'message' => 'Invalid reward voucher code.',
            ];
        }

        if ($ledger->status === 'redeemed') {
            return [
                'valid' => false,
                'message' => 'This reward voucher has already been redeemed.',
            ];
        }

        if ($ledger->isExpired()) {
            return [
                'valid' => false,
                'message' => 'This reward voucher has expired on ' . $ledger->expires_at->format('d M Y') . '.',
            ];
        }

        // Calculate discount amount
        $discountAmount = 0.00;
        $rewardValue = (float) $ledger->value;

        switch ($ledger->reward_type) {
            case 'print_credit':
                $discountAmount = min($rewardValue, $cartSubtotal);
                break;
            case 'free_product':
                $discountAmount = min($rewardValue, $cartSubtotal);
                break;
            case 'premium_upgrade':
                $discountAmount = min($rewardValue, $cartSubtotal);
                break;
            case 'shipping_upgrade':
                $discountAmount = $rewardValue;
                break;
            default:
                $discountAmount = min($rewardValue, $cartSubtotal);
        }

        return [
            'valid' => true,
            'reward_code' => $ledger->reward_code,
            'title' => $ledger->title,
            'reward_type' => $ledger->reward_type,
            'discount_amount' => round($discountAmount, 2),
            'terms' => $ledger->terms,
            'how_to_use' => $ledger->how_to_use,
        ];
    }
}
