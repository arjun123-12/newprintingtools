<?php

namespace App\Services\Rewards;

use App\Enums\PaymentStatus;
use App\Models\CustomerRewardLedger;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderReviewLink;
use App\Models\OrderSpinEntitlement;
use App\Models\Payment;
use App\Models\SpinReward;
use App\Models\SpinRewardCategory;
use App\Models\SpinWinSetting;
use App\Models\User;
use App\Services\Notification\OrderNotificationService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class SpinRewardService
{
    /**
     * Resolve the appropriate reward category for an order/customer.
     * Rule:
     * 1. Check order snapshot business_category.
     * 2. Fall back to user business_category.
     * 3. Look up active category; if found and it has active available rewards, return it.
     * 4. Otherwise, seamlessly fall back to the Default category.
     */
    public function resolveCategoryForOrder(Order $order, ?User $user = null): ?SpinRewardCategory
    {
        $categoryKey = $order->business_category
            ?: ($user?->business_category ?: $order->user?->business_category);

        if (! empty($categoryKey)) {
            $category = SpinRewardCategory::query()
                ->where('is_active', true)
                ->where(function ($q) use ($categoryKey) {
                    $q->where('code', $categoryKey)
                        ->orWhere('id', $categoryKey);
                })
                ->first();

            if ($category) {
                // Check if this category has active available rewards
                $hasRewards = SpinReward::query()
                    ->where('category_id', $category->id)
                    ->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                    })
                    ->exists();

                if ($hasRewards) {
                    return $category;
                }
            }
        }

        // Fallback to configured Default category
        return SpinRewardCategory::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? SpinRewardCategory::query()
                ->where('code', 'default')
                ->first();
    }

    /**
     * Get active configured wheel segments for a specific category (or Default fallback).
     */
    public function getActiveSegments(?SpinRewardCategory $category = null): Collection
    {
        $query = SpinReward::query()
            ->with('category')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('inventory')->orWhere('inventory', '>', 0);
            });

        if ($category) {
            $query->where('category_id', $category->id);
        } else {
            // Default category fallback
            $defaultCat = SpinRewardCategory::where('is_default', true)->first();
            if ($defaultCat) {
                $query->where('category_id', $defaultCat->id);
            }
        }

        $rewards = $query->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        // If the specified category had no rewards, fallback to Default category
        if ($rewards->isEmpty() && $category && ! $category->is_default) {
            $defaultCat = SpinRewardCategory::where('is_default', true)->first();
            if ($defaultCat) {
                $rewards = SpinReward::query()
                    ->with('category')
                    ->where('category_id', $defaultCat->id)
                    ->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                    })
                    ->orderBy('sort_order', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();
            }
        }

        return $rewards->values()->map(function ($reward, $index) {
            return [
                'index' => $index,
                'id' => $reward->id,
                'category_id' => $reward->category_id,
                'category_code' => $reward->category?->code ?? 'default',
                'category_name' => $reward->category?->name ?? 'Default / General',
                'code' => $reward->code,
                'title' => $reward->title,
                'badge_text' => $reward->badge_text,
                'reward_type' => $reward->reward_type,
                'value' => (float) $reward->value,
                'inventory' => $reward->inventory,
                'terms_text' => $reward->terms_text,
                'how_to_use' => $reward->how_to_use,
                'color_bg' => $reward->color_bg,
                'color_text' => $reward->color_text,
                'icon' => $reward->icon,
            ];
        });
    }

    /**
     * Strictly verify whether payment was genuinely confirmed through a succeeded gateway transaction.
     * Manually altering orders.payment_status to 'paid' in DB or admin without a succeeded Payment record does not qualify.
     */
    public function isPaymentGenuinelyVerified(Order $order): bool
    {
        $statusPaid = $order->payment_status === PaymentStatus::PAID
            || ($order->payment_status->value ?? null) === 'paid'
            || $order->payment_status === 'paid';

        if (! $statusPaid) {
            return false;
        }

        return Payment::where('order_id', $order->id)
            ->where('status', 'succeeded')
            ->exists();
    }

    /**
     * Resolve and authorize access to an order for Spin & Win.
     * Supports:
     * 1. Tokenized manual-order review link (OrderReviewLink token):
     *    - Validates token is active, not revoked, and not expired.
     *    - Ensures order matches review link order (prevents token/order mismatches).
     *    - Allows guest manual-order customers without website account.
     * 2. Direct authenticated customer order (Cart checkout flow):
     *    - Requires authenticated user owning the order or admin access.
     *    - Disallows unauthenticated access using only an order number (prevents guessing).
     */
    public function resolveOrderFromRequest(?string $orderNumber, ?string $reviewToken = null, ?User $user = null): Order
    {
        if (! empty($reviewToken)) {
            $link = OrderReviewLink::where('token', $reviewToken)->first();

            if (! $link) {
                throw new AccessDeniedHttpException('This order review link is invalid or does not exist.');
            }

            if (! $link->isValid()) {
                if ($link->status === 'revoked' || $link->revoked_at !== null) {
                    throw new AccessDeniedHttpException('This order review link has been revoked.');
                }

                if ($link->expires_at && $link->expires_at->isPast()) {
                    throw new AccessDeniedHttpException('This order review link has expired.');
                }

                throw new AccessDeniedHttpException('This order review link is inactive.');
            }

            $order = $link->order;
            if (! $order) {
                throw new InvalidArgumentException('Order referenced by review link does not exist.');
            }

            if (! empty($orderNumber) && $order->order_number !== $orderNumber) {
                throw new InvalidArgumentException('Order number does not match the provided review link token.');
            }

            return $order;
        }

        if (empty($orderNumber)) {
            throw new InvalidArgumentException('Order number or valid review token is required.');
        }

        $order = Order::where('order_number', $orderNumber)->first();
        if (! $order) {
            throw new InvalidArgumentException('Order not found.');
        }

        // Customer must be authenticated when accessing by order_number alone
        if (! $user) {
            throw new AccessDeniedHttpException('Authentication or a valid tokenized review link is required to access reward eligibility.');
        }

        // Authenticated customer can only access their own orders unless they have admin panel access
        if ($order->user_id !== $user->id && ! $user->canAccessAdminPanel()) {
            throw new AccessDeniedHttpException('You are not authorized to view reward eligibility for this order.');
        }

        return $order;
    }

    /**
     * Check if a specific order qualifies for a spin and return entitlement state + category segments.
     * Supports both authenticated cart checkout orders and tokenized manual-order review links.
     */
    public function getEligibility(?string $orderNumber, ?User $user = null, ?string $reviewToken = null): array
    {
        $enabled = (bool) SpinWinSetting::get('enabled', true);
        if (! $enabled) {
            return [
                'eligible' => false,
                'reason' => 'The Spin & Win reward promotion is currently not active.',
            ];
        }

        $order = $this->resolveOrderFromRequest($orderNumber, $reviewToken, $user);

        // Strict security requirement: Backend verification of payment status via genuine succeeded transaction
        if (! $this->isPaymentGenuinelyVerified($order)) {
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

        // Category resolution with Default fallback
        $category = $this->resolveCategoryForOrder($order, $user);
        $segments = $this->getActiveSegments($category);

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

        $categoryPayload = $category ? [
            'id' => $category->id,
            'code' => $category->code,
            'name' => $category->name,
            'description' => $category->description,
            'is_default' => (bool) $category->is_default,
        ] : null;

        // If the order has already spun, return the existing won prize
        if ($entitlement->status === 'spun' || $entitlement->spun_at !== null) {
            $ledger = CustomerRewardLedger::with(['category', 'spinReward.category'])
                ->where('entitlement_id', $entitlement->id)
                ->first();

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
                'category' => $categoryPayload,
                'prize' => $ledger ? [
                    'id' => $ledger->id,
                    'category_id' => $ledger->category_id,
                    'category_name' => $ledger->category_name ?? $ledger->category?->name ?? 'Default / General',
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
            'category' => $categoryPayload,
            'wheel_segments' => $segments,
            'min_order_spend' => $minSpend,
            'order_total' => $orderTotal,
        ];
    }

    /**
     * Execute server-side prize selection, atomically decrement limited inventory,
     * save in durable ledger with category, and return target slice index.
     * Supports both authenticated cart checkout orders and tokenized manual-order review links.
     */
    public function executeSpin(?string $orderNumber, string $spinToken, ?User $user = null, ?string $clientIp = null, ?string $reviewToken = null): array
    {
        $enabled = (bool) SpinWinSetting::get('enabled', true);
        if (! $enabled) {
            throw new RuntimeException('Spin & Win is currently unavailable.');
        }

        $order = $this->resolveOrderFromRequest($orderNumber, $reviewToken, $user);

        // Strict backend payment check: genuine succeeded payment required
        if (! $this->isPaymentGenuinelyVerified($order)) {
            throw new RuntimeException('Cannot spin. Payment is not confirmed for this order.');
        }

        // Atomic transaction with row lock to prevent race conditions, double clicks, and multiple tabs
        $result = DB::transaction(function () use ($order, $spinToken, $user, $clientIp) {
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
                $existingLedger = CustomerRewardLedger::with(['category', 'spinReward.category'])
                    ->where('entitlement_id', $entitlement->id)
                    ->first();

                if ($existingLedger) {
                    $category = $existingLedger->category
                        ?: $this->resolveCategoryForOrder($order, $user);
                    $segments = $this->getActiveSegments($category);

                    $matched = $segments->firstWhere('id', $existingLedger->spin_reward_id)
                        ?? $segments->firstWhere('code', $existingLedger->spinReward?->code);
                    $segmentIndex = $matched['index'] ?? 0;

                    return [
                        'success' => true,
                        'already_spun' => true,
                        'category' => $category ? [
                            'id' => $category->id,
                            'code' => $category->code,
                            'name' => $category->name,
                        ] : null,
                        'prize' => [
                            'id' => $existingLedger->id,
                            'category_id' => $existingLedger->category_id,
                            'category_name' => $existingLedger->category_name ?? $existingLedger->category?->name ?? 'Default / General',
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

            // Re-resolve category at spin time
            $category = $this->resolveCategoryForOrder($order, $user);
            $segments = $this->getActiveSegments($category);

            if ($segments->isEmpty()) {
                throw new RuntimeException('No active rewards available for this category.');
            }

            // Snapshot category onto order if not set
            if (empty($order->business_category) && $category) {
                $order->update(['business_category' => $category->code]);
            }

            $orderTotal = (float) ($order->total_inc_gst ?? $order->total);

            // Fetch candidate rewards for atomic selection
            $eligibleRewards = SpinReward::query()
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                })
                ->when($category, fn ($q) => $q->where('category_id', $category->id))
                ->where('min_order_spend', '<=', $orderTotal)
                ->orderBy('sort_order', 'asc')
                ->get();

            if ($eligibleRewards->isEmpty()) {
                $eligibleRewards = SpinReward::query()
                    ->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                    })
                    ->when($category, fn ($q) => $q->where('category_id', $category->id))
                    ->orderBy('sort_order', 'asc')
                    ->get();
            }

            // If category rewards ran out, fallback to Default category
            if ($eligibleRewards->isEmpty()) {
                $defaultCat = SpinRewardCategory::where('is_default', true)->first();
                if ($defaultCat && ($category === null || $category->id !== $defaultCat->id)) {
                    $category = $defaultCat;
                    $segments = $this->getActiveSegments($category);
                    $eligibleRewards = SpinReward::query()
                        ->where('category_id', $defaultCat->id)
                        ->where('is_active', true)
                        ->where(function ($q) {
                            $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                        })
                        ->orderBy('sort_order', 'asc')
                        ->get();
                }
            }

            if ($eligibleRewards->isEmpty()) {
                throw new RuntimeException('All configured rewards in this category are currently out of stock.');
            }

            // Cryptographically secure weighted selection with inventory decrement attempt
            $selectedReward = null;
            $candidates = $eligibleRewards->values();

            while ($candidates->isNotEmpty()) {
                $totalWeight = $candidates->sum('probability_weight');
                $randomPoint = random_int(1, max(1, $totalWeight));
                $cumulative = 0;
                $pick = $candidates->first();

                foreach ($candidates as $reward) {
                    $cumulative += $reward->probability_weight;
                    if ($randomPoint <= $cumulative) {
                        $pick = $reward;
                        break;
                    }
                }

                // If limited inventory, perform atomic decrement
                if ($pick->inventory !== null) {
                    $decremented = SpinReward::query()
                        ->where('id', $pick->id)
                        ->where('inventory', '>', 0)
                        ->decrement('inventory');

                    if ($decremented > 0) {
                        $pick->increment('inventory_consumed');
                        $selectedReward = $pick;
                        break;
                    } else {
                        // Concurrently depleted, remove from candidates and re-select
                        $candidates = $candidates->filter(fn ($r) => $r->id !== $pick->id)->values();
                        continue;
                    }
                } else {
                    // Unlimited inventory
                    $pick->increment('inventory_consumed');
                    $selectedReward = $pick;
                    break;
                }
            }

            if (! $selectedReward) {
                throw new RuntimeException('Unable to allocate a reward at this moment. Please try again.');
            }

            // Determine target segment index on the wheel
            $matchedSegment = $segments->firstWhere('id', $selectedReward->id);
            $segmentIndex = $matchedSegment['index'] ?? 0;

            // Generate unique, durable reward code (e.g. SPIN-9F2K-7X3M)
            $rewardCode = 'SPIN-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4));
            $claimToken = Str::random(48);

            // Record in durable reward ledger with category snapshot
            $ledger = CustomerRewardLedger::create([
                'entitlement_id' => $entitlement->id,
                'order_id' => $order->id,
                'user_id' => $user?->id ?? $order->user_id,
                'spin_reward_id' => $selectedReward->id,
                'category_id' => $category?->id,
                'category_name' => $category?->name ?? 'Default / General',
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
                "Customer spun the Wheel ({$ledger->category_name}) and won: {$selectedReward->title} (Code: {$rewardCode}).",
                'customer',
                null,
                [
                    'category_id' => $category?->id,
                    'category_name' => $ledger->category_name,
                    'reward_id' => $selectedReward->id,
                    'reward_code' => $rewardCode,
                    'reward_type' => $selectedReward->reward_type,
                    'value' => (float) $selectedReward->value,
                ]
            );

            return [
                'success' => true,
                'already_spun' => false,
                'category' => $category ? [
                    'id' => $category->id,
                    'code' => $category->code,
                    'name' => $category->name,
                ] : null,
                'prize' => [
                    'id' => $ledger->id,
                    'category_id' => $ledger->category_id,
                    'category_name' => $ledger->category_name,
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

        // Notify after the reward and entitlement have committed. Repeated spin
        // requests return the existing prize and do not send another email.
        if (! ($result['already_spun'] ?? false)) {
            $ledger = CustomerRewardLedger::find($result['prize']['id'] ?? null);
            if ($ledger) {
                app(OrderNotificationService::class)->sendSpinRewardWonEmail($ledger, $order->loadMissing('user'));
            }
        }

        return $result;
    }

    /**
     * Retrieve all active business categories available for customer profiles or admin selection.
     */
    public function getActiveRewardCategories(): Collection
    {
        return SpinRewardCategory::query()
            ->where('is_active', true)
            ->withCount(['rewards as active_rewards_count' => function ($q) {
                $q->where('is_active', true)
                    ->where(function ($sub) {
                        $sub->whereNull('inventory')->orWhere('inventory', '>', 0);
                    });
            }])
            ->orderBy('sort_order', 'asc')
            ->get();
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
            ->with(['order:id,order_number', 'spinReward', 'category'])
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
                'category_id' => $l->category_id,
                'category_name' => $l->category_name ?? $l->category?->name ?? 'Default / General',
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
            'customer_business_category' => $user->business_category,
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
        $ledger = CustomerRewardLedger::with('category')->where('reward_code', $code)->first();

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
            case 'free_product':
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
            'category_name' => $ledger->category_name ?? $ledger->category?->name,
            'reward_type' => $ledger->reward_type,
            'discount_amount' => round($discountAmount, 2),
            'terms' => $ledger->terms,
            'how_to_use' => $ledger->how_to_use,
        ];
    }
}
