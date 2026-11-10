<?php

namespace App\Services\Rewards;

use App\Enums\PaymentStatus;
use App\Mail\SpinWheelInvitationMail;
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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
            ->where('is_active', true);

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
                'target_product' => $reward->target_product,
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
    public function resolveOrderFromRequest(?string $orderNumber, ?string $reviewToken = null, ?User $user = null, ?string $spinToken = null): Order
    {
        if (! empty($spinToken)) {
            $entitlement = OrderSpinEntitlement::where('spin_token', $spinToken)->first();

            if (! $entitlement) {
                throw new AccessDeniedHttpException('This spin reward link is invalid or has expired.');
            }

            $order = $entitlement->order;
            if (! $order) {
                throw new InvalidArgumentException('Order referenced by spin reward token does not exist.');
            }

            return $order;
        }

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
    public function getEligibility(?string $orderNumber, ?User $user = null, ?string $reviewToken = null, ?string $spinToken = null): array
    {
        $enabled = (bool) SpinWinSetting::get('enabled', true);
        if (! $enabled) {
            return [
                'eligible' => false,
                'reason' => 'The Spin & Win reward promotion is currently not active.',
            ];
        }

        $standalone = $spinToken ? OrderSpinEntitlement::where('spin_token', $spinToken)->whereNull('order_id')->first() : null;
        if ($standalone) {
            $assignedReward = $standalone->assigned_reward_id ? SpinReward::with('category')->find($standalone->assigned_reward_id) : null;
            $category = $assignedReward?->category;
            $segments = $this->getActiveSegments($category);
            if ($standalone->assigned_reward_id && ! $segments->contains('id', $standalone->assigned_reward_id)) {
                $segments = collect();
            }
            if ($segments->count() < 2) {
                return ['eligible' => false, 'reason' => 'The selected wheel rewards are not available.'];
            }
            $ledger = $standalone->status === 'spun'
                ? CustomerRewardLedger::with(['category', 'spinReward.category'])->where('entitlement_id', $standalone->id)->first()
                : null;
            return [
                'eligible' => true,
                'has_spun' => (bool) $ledger,
                'order_number' => null,
                'spin_token' => $standalone->spin_token,
                'category' => $segments->first() ? ['id' => $segments->first()['category_id'], 'code' => $segments->first()['category_code'], 'name' => $segments->first()['category_name']] : null,
                'wheel_segments' => $segments,
                'prize' => $ledger ? [
                    'id' => $ledger->id, 'category_id' => $ledger->category_id, 'category_name' => $ledger->category_name,
                    'reward_code' => $ledger->reward_code, 'title' => $ledger->title, 'badge_text' => $ledger->badge_text,
                    'reward_type' => $ledger->reward_type, 'target_product' => $ledger->target_product, 'value' => (float) $ledger->value,
                    'segment_index' => $segments->firstWhere('id', $ledger->spin_reward_id)['index'] ?? 0,
                    'terms_text' => $ledger->terms, 'how_to_use' => $ledger->how_to_use,
                    'expires_at' => $ledger->expires_at?->toIso8601String(), 'status' => $ledger->status, 'claim_token' => $ledger->claim_token,
                ] : null,
            ];
        }

        $order = $this->resolveOrderFromRequest($orderNumber, $reviewToken, $user, $spinToken);

        // A valid admin-issued spin token is an explicit invitation and permits
        // the customer to spin even when the order is still awaiting payment.
        $invited = $spinToken && OrderSpinEntitlement::where('order_id', $order->id)
            ->where('spin_token', $spinToken)
            ->exists();
        if (! $this->isPaymentGenuinelyVerified($order) && ! $invited) {
            return [
                'eligible' => false,
                'reason' => 'Payment has not been completed or verified and no Spin Wheel invitation is available.',
            ];
        }

        // Minimum order spend check
        $minSpend = (float) SpinWinSetting::get('min_order_spend', 0.00);
        $orderTotal = (float) ($order->total_inc_gst ?? $order->total);
        if ($minSpend > 0 && $orderTotal < $minSpend && ! $invited) {
            return [
                'eligible' => false,
                'reason' => "This order does not meet the minimum spend requirement of AUD $" . number_format($minSpend, 2) . " for Spin & Win.",
            ];
        }

        // Category resolution with Default fallback
        $category = $this->resolveCategoryForOrder($order, $user);
        $segments = $this->getActiveSegments($category);

        // Safe entitlement retrieval or creation in atomic transaction
        $entitlement = DB::transaction(function () use ($order) {
            return OrderSpinEntitlement::firstOrCreate(
                ['order_id' => $order->id],
                [
                    'user_id' => $order->user_id,
                    'spin_token' => Str::random(48),
                    'status' => 'eligible',
                ]
            );
        });

        if ($entitlement->assigned_reward_id) {
            $assignedReward = SpinReward::with('category')->find($entitlement->assigned_reward_id);
            $category = $assignedReward?->category ?? $category;
            $segments = $this->getActiveSegments($category);
        }

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
                    'target_product' => $ledger->target_product,
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

        $standalone = OrderSpinEntitlement::where('spin_token', $spinToken)->whereNull('order_id')->exists();
        if ($standalone) {
            return $this->executeStandaloneSpin($spinToken, $clientIp);
        }
        $order = $this->resolveOrderFromRequest($orderNumber, $reviewToken, $user, $spinToken);

        // An admin-issued spin token acts as an explicit invitation, including
        // for orders that have not been paid yet.
        $invited = OrderSpinEntitlement::where('order_id', $order->id)
            ->where('spin_token', $spinToken)
            ->exists();
        if (! $this->isPaymentGenuinelyVerified($order) && ! $invited) {
            throw new RuntimeException('Cannot spin. Payment has not been completed or verified and this order has no Spin Wheel invitation.');
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
                            'target_product' => $existingLedger->target_product,
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
            if ($entitlement->assigned_reward_id) {
                $category = SpinReward::with('category')->find($entitlement->assigned_reward_id)?->category ?? $category;
            }
            $segments = $this->getActiveSegments($category);
            $wheelRewardIds = collect($segments)->pluck('id')->all();

            if ($segments->isEmpty()) {
                throw new RuntimeException('No active rewards available for this category.');
            }

            // Snapshot category onto order if not set
            if (empty($order->business_category) && $category && ! $entitlement->assigned_reward_id) {
                $order->update(['business_category' => $category->code]);
            }

            $orderTotal = (float) ($order->total_inc_gst ?? $order->total);

            // Fetch candidate rewards for atomic selection
            $eligibleRewards = SpinReward::query()
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                })
                ->whereIn('id', $wheelRewardIds)
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
                    ->whereIn('id', $wheelRewardIds)
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
                    $wheelRewardIds = collect($segments)->pluck('id')->all();
                    $eligibleRewards = SpinReward::query()
                        ->where('category_id', $defaultCat->id)
                        ->where('is_active', true)
                        ->whereIn('id', $wheelRewardIds)
                        ->where(function ($q) {
                            $q->whereNull('inventory')->orWhere('inventory', '>', 0);
                        })
                        ->orderBy('sort_order', 'asc')
                        ->get();
                }
            }

            if ($entitlement->assigned_reward_id) {
                if (! in_array($entitlement->assigned_reward_id, $wheelRewardIds, false)) {
                    throw new RuntimeException('The reward selected for this invitation is not on this order’s wheel.');
                }
                $eligibleRewards = $eligibleRewards->where('id', $entitlement->assigned_reward_id)->values();
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
                'user_id' => $order->user_id,
                'spin_reward_id' => $selectedReward->id,
                'category_id' => $category?->id,
                'category_name' => $category?->name ?? 'Default / General',
                'reward_code' => $rewardCode,
                'reward_type' => $selectedReward->reward_type,
                'target_product' => $selectedReward->target_product,
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
                    'target_product' => $ledger->target_product,
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

    private function executeStandaloneSpin(string $spinToken, ?string $clientIp): array
    {
        return DB::transaction(function () use ($spinToken, $clientIp) {
            $entitlement = OrderSpinEntitlement::where('spin_token', $spinToken)->whereNull('order_id')->lockForUpdate()->first();
            if (! $entitlement) {
                throw new AccessDeniedHttpException('This spin reward link is invalid or has expired.');
            }
            $assigned = $entitlement->assigned_reward_id ? SpinReward::with('category')->find($entitlement->assigned_reward_id) : null;
            $segments = $this->getActiveSegments($assigned?->category);
            if ($entitlement->status === 'spun') {
                $ledger = CustomerRewardLedger::where('entitlement_id', $entitlement->id)->first();
                if ($ledger) {
                    return ['success' => true, 'already_spun' => true, 'category' => null, 'prize' => [
                        'id' => $ledger->id, 'reward_code' => $ledger->reward_code, 'title' => $ledger->title,
                        'badge_text' => $ledger->badge_text, 'reward_type' => $ledger->reward_type, 'target_product' => $ledger->target_product, 'value' => (float) $ledger->value,
                        'segment_index' => $segments->firstWhere('id', $ledger->spin_reward_id)['index'] ?? 0,
                        'terms_text' => $ledger->terms, 'how_to_use' => $ledger->how_to_use,
                        'expires_at' => $ledger->expires_at?->toIso8601String(), 'claim_token' => $ledger->claim_token,
                    ]];
                }
            }
            if ($segments->count() < 2) throw new RuntimeException('At least two active rewards are required to spin.');
            $target = $entitlement->assigned_reward_id
                ? $segments->firstWhere('id', $entitlement->assigned_reward_id)
                : null;
            if (! $target) $target = $segments[random_int(0, $segments->count() - 1)];
            $reward = SpinReward::where('id', $target['id'])->where('is_active', true)->lockForUpdate()->first();
            if (! $reward || ($reward->inventory !== null && $reward->inventory < 1)) {
                throw new RuntimeException('The reward selected for this invitation is no longer available.');
            }
            if ($reward->inventory !== null) $reward->decrement('inventory');
            $reward->increment('inventory_consumed');
            $ledger = CustomerRewardLedger::create([
                'entitlement_id' => $entitlement->id, 'order_id' => null, 'user_id' => $entitlement->user_id,
                'spin_reward_id' => $reward->id, 'category_id' => $reward->category_id,
                'category_name' => $reward->category?->name ?? 'Default / General',
                'reward_code' => 'SPIN-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)),
                'reward_type' => $reward->reward_type, 'target_product' => $reward->target_product, 'title' => $reward->title, 'badge_text' => $reward->badge_text,
                'value' => $reward->value, 'terms' => $reward->terms_text, 'how_to_use' => $reward->how_to_use,
                'expires_at' => now()->addDays(max(1, $reward->expiry_days)), 'status' => 'active', 'claim_token' => Str::random(48),
            ]);
            $entitlement->update(['status' => 'spun', 'spun_at' => now(), 'client_ip' => $clientIp]);
            return ['success' => true, 'already_spun' => false, 'category' => [
                'id' => $reward->category_id, 'code' => $reward->category?->code, 'name' => $reward->category?->name,
            ], 'prize' => [
                'id' => $ledger->id, 'category_id' => $ledger->category_id, 'category_name' => $ledger->category_name,
                'reward_code' => $ledger->reward_code, 'title' => $ledger->title, 'badge_text' => $ledger->badge_text,
                'reward_type' => $ledger->reward_type, 'value' => (float) $ledger->value,
                'target_product' => $ledger->target_product,
                'segment_index' => $target['index'], 'terms_text' => $ledger->terms, 'how_to_use' => $ledger->how_to_use,
                'expires_at' => $ledger->expires_at->toIso8601String(), 'claim_token' => $ledger->claim_token,
            ]];
        });
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
                'target_product' => $l->target_product,
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

    /** Attach a won reward to the matching signed-in customer account. */
    public function claimReward(User $user, string $claimToken): CustomerRewardLedger
    {
        return DB::transaction(function () use ($user, $claimToken) {
            $ledger = CustomerRewardLedger::with(['order.user', 'entitlement'])
                ->where('claim_token', $claimToken)
                ->lockForUpdate()
                ->first();

            if (! $ledger) {
                throw new InvalidArgumentException('This reward claim link is invalid.');
            }

            if ($ledger->user_id && (int) $ledger->user_id !== (int) $user->id) {
                throw new InvalidArgumentException('This reward is already linked to another customer account.');
            }

            $order = $ledger->order;
            if ($order?->user_id && (int) $order->user_id !== (int) $user->id) {
                throw new InvalidArgumentException('Please sign in with the account that placed this order.');
            }

            $shipping = is_array($order?->shipping_address) ? $order->shipping_address : (json_decode($order?->shipping_address ?? '[]', true) ?: []);
            $billing = is_array($order?->billing_address) ? $order->billing_address : (json_decode($order?->billing_address ?? '[]', true) ?: []);
            $recipientEmail = $shipping['email']
                ?? $billing['email']
                ?? $order?->user?->email
                ?? $ledger->entitlement?->email;

            if (! $recipientEmail || strtolower(trim($recipientEmail)) !== strtolower(trim($user->email))) {
                throw new InvalidArgumentException('Sign in with the email address that received this Spin Wheel invitation.');
            }

            $ledger->user_id = $user->id;
            $ledger->save();

            if ($ledger->entitlement && (int) $ledger->entitlement->user_id !== (int) $user->id) {
                $ledger->entitlement->user_id = $user->id;
                $ledger->entitlement->save();
            }

            return $ledger->fresh();
        });
    }

    /**
     * Validate and preview application of a reward code on future checkout.
     * Note: A reward won after payment applies ONLY to a future eligible order.
     */
    public function validateRewardForCheckout(string $code, float $cartSubtotal, ?User $user = null, array $cartItems = []): array
    {
        $code = strtoupper(trim($code));
        $ledger = CustomerRewardLedger::with(['category', 'order'])->where('reward_code', $code)->first();

        if (! $ledger) {
            return [
                'valid' => false,
                'message' => 'Invalid reward voucher code.',
            ];
        }

        if (!$user) {
            return ['valid' => false, 'message' => 'Sign in to the account that owns this reward before using it.'];
        }
        $ownerId = $ledger->user_id ?: $ledger->order?->user_id;
        if (!$ownerId || (int) $ownerId !== (int) $user->id) {
            return ['valid' => false, 'message' => 'This reward belongs to another customer account.'];
        }
        if (\App\Models\ClientBrief::where('spin_reward_ledger_id', $ledger->id)->exists()) {
            return ['valid' => false, 'message' => 'This reward is attached to your design query and will be applied to its linked order.'];
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

        // Product promotions only apply to the configured product line in this cart.
        $discountAmount = 0.00;
        $rewardValue = (float) $ledger->value;
        $targetSubtotal = 0.0;
        $targetUnitValue = 0.0;
        if (in_array($ledger->reward_type, ['product_discount', 'free_product'], true)) {
            $targetName = mb_strtolower(trim((string) $ledger->target_product));
            if ($targetName === '') {
                return ['valid' => false, 'message' => 'This product reward is not configured yet. Please contact our team.'];
            }
            foreach ($cartItems as $item) {
                $cartProductName = mb_strtolower(trim((string) ($item['product_name'] ?? '')));
                if (!str_contains($cartProductName, $targetName)) continue;
                $lineTotal = (float) ($item['total_inc_gst'] ?? $item['subtotal_inc_gst'] ?? 0);
                $quantity = max(1, (int) ($item['quantity'] ?? 1));
                $targetSubtotal += $lineTotal;
                $targetUnitValue += $lineTotal / $quantity;
            }
            if ($targetSubtotal <= 0) {
                return ['valid' => false, 'message' => "Add {$ledger->target_product} to your cart to use this reward."];
            }
        }

        switch ($ledger->reward_type) {
            case 'print_credit':
            case 'premium_upgrade':
                $discountAmount = min($rewardValue, $cartSubtotal);
                break;
            case 'product_discount':
                $discountAmount = min($targetSubtotal, $targetSubtotal * min(100, max(0, $rewardValue)) / 100);
                break;
            case 'free_product':
                // A free product reward covers one unit of the configured product.
                $discountAmount = min($targetSubtotal, $targetUnitValue);
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
            'target_product' => $ledger->target_product,
            'discount_amount' => round($discountAmount, 2),
            'terms' => $ledger->terms,
            'how_to_use' => $ledger->how_to_use,
        ];
    }

    /**
     * Send Spin Wheel promotional invitation email for a specific qualifying paid order.
     */
    public function sendSpinInvitationForOrder(
        Order $order,
        ?string $customSubject = null,
        ?string $customHeadline = null,
        ?string $customMessage = null,
        ?int $assignedRewardId = null
    ): bool {
        // Find or create atomic entitlement with unique spin_token
        $entitlement = OrderSpinEntitlement::firstOrCreate(
            ['order_id' => $order->id],
            [
                'user_id' => $order->user_id,
                'spin_token' => Str::random(48),
                'status' => 'eligible',
            ]
        );

        if ($entitlement->status === 'spun' || $entitlement->spun_at !== null) {
            return false;
        }

        if ($assignedRewardId && $entitlement->status !== 'spun') {
            $assignedReward = SpinReward::with('category')->whereKey($assignedRewardId)->where('is_active', true)->first();
            if (! $assignedReward) {
                throw new InvalidArgumentException('Selected reward is not active.');
            }
            if ($assignedReward->inventory !== null && $assignedReward->inventory < 1) {
                throw new InvalidArgumentException('The selected reward is out of stock.');
            }
            $entitlement->update(['assigned_reward_id' => $assignedRewardId]);
        }

        $shipping = is_array($order->shipping_address) ? $order->shipping_address : (json_decode($order->shipping_address ?? '[]', true) ?: []);
        $billing = is_array($order->billing_address) ? $order->billing_address : (json_decode($order->billing_address ?? '[]', true) ?: []);

        $targetEmail = $shipping['email']
            ?? $billing['email']
            ?? $order->user?->email
            ?? null;

        if (empty($targetEmail)) {
            Log::warning("Spin wheel invitation skipped for order {$order->order_number}: recipient email not found.");
            return false;
        }

        $customerName = $shipping['name']
            ?? $billing['name']
            ?? $order->user?->name
            ?? 'Valued Customer';

        $frontendUrl = rtrim(config('app.frontend_url', config('app.url', 'http://localhost:3000')), '/');
        $spinUrl = "{$frontendUrl}/rewards/spin?token={$entitlement->spin_token}&order={$order->order_number}";

        Log::info("Sending spin wheel invitation email to {$targetEmail} for order #{$order->order_number}");

        Mail::to($targetEmail)->send(new SpinWheelInvitationMail(
            customerName: $customerName,
            spinUrl: $spinUrl,
            orderNumber: $order->order_number,
            customSubject: $customSubject,
            customHeadline: $customHeadline,
            customMessage: $customMessage
        ));

        // Audit log in order activities (non-blocking)
        try {
            OrderActivity::record(
                $order->id,
                'spin_wheel_invitation_sent',
                "Spin Wheel VIP promotional invitation email sent to {$targetEmail}.",
                'system'
            );
        } catch (\Throwable $e) {
            Log::warning("OrderActivity record failed for order {$order->order_number}: " . $e->getMessage());
        }

        return true;
    }

    /**
     * Admin bulk promotional sender: send Spin Wheel invitation to selected paid customers or contacts.
     */
    public function sendPromotionalSpinInvitations(
        array $customerIds = [],
        array $orderIds = [],
        array $contactIds = [],
        bool $allPaid = false,
        bool $allOrders = false,
        ?string $subject = null,
        ?string $headline = null,
        ?string $message = null,
        ?int $assignedRewardId = null,
        array $rewardAssignments = []
    ): array {
        $sentCount = 0;
        $processedEmails = [];

        // 1. Process specific order IDs if provided
        if (! $allOrders && ! empty($orderIds)) {
            $orders = Order::with('user')->whereIn('id', $orderIds)->get();
            foreach ($orders as $order) {
                $shipping = is_array($order->shipping_address) ? $order->shipping_address : (json_decode($order->shipping_address ?? '[]', true) ?: []);
                $billing = is_array($order->billing_address) ? $order->billing_address : (json_decode($order->billing_address ?? '[]', true) ?: []);
                $email = strtolower($shipping['email'] ?? $billing['email'] ?? $order->user?->email ?? '');
                if ($email) {
                    $processedEmails[] = $email;
                }
                $rewardId = $rewardAssignments['orders'][$order->id] ?? $assignedRewardId;
                if ($this->sendSpinInvitationForOrder($order, $subject, $headline, $message, $rewardId ? (int) $rewardId : null)) {
                    $sentCount++;
                }
            }
        }

        // Admin-selected all-orders campaign includes unpaid and pending orders too.
        if ($allOrders) {
            $orders = Order::with(['user', 'spinEntitlement'])->latest()->get();
            foreach ($orders as $order) {
                if ($order->spinEntitlement?->status === 'spun') {
                    continue;
                }

                $shipping = is_array($order->shipping_address) ? $order->shipping_address : (json_decode($order->shipping_address ?? '[]', true) ?: []);
                $billing = is_array($order->billing_address) ? $order->billing_address : (json_decode($order->billing_address ?? '[]', true) ?: []);
                $email = strtolower(trim($shipping['email'] ?? $billing['email'] ?? $order->user?->email ?? ''));
                if (! $email) {
                    continue;
                }
                $processedEmails[] = $email;

                $rewardId = $rewardAssignments['orders'][$order->id] ?? $assignedRewardId;
                if ($this->sendSpinInvitationForOrder($order, $subject, $headline, $message, $rewardId ? (int) $rewardId : null)) {
                    $sentCount++;
                }
            }
        }

        // 2. Process all paid customers if selected
        if ($allPaid && ! $allOrders) {
            $paidOrders = Order::query()
                ->where(function ($q) {
                    $q->where('payment_status', PaymentStatus::PAID)
                      ->orWhere('payment_status', 'paid');
                })
                ->whereDoesntHave('spinEntitlement', function ($q) {
                    $q->where('status', 'spun');
                })
                ->latest()
                ->take(100)
                ->get();

            foreach ($paidOrders as $order) {
                $shipping = is_array($order->shipping_address) ? $order->shipping_address : (json_decode($order->shipping_address ?? '[]', true) ?: []);
                $billing = is_array($order->billing_address) ? $order->billing_address : (json_decode($order->billing_address ?? '[]', true) ?: []);
                $targetEmail = $shipping['email'] ?? $billing['email'] ?? $order->user?->email ?? null;

                if ($targetEmail && ! in_array(strtolower($targetEmail), $processedEmails, true)) {
                    $processedEmails[] = strtolower($targetEmail);
                    $rewardId = $rewardAssignments['orders'][$order->id] ?? $assignedRewardId;
                    if ($this->sendSpinInvitationForOrder($order, $subject, $headline, $message, $rewardId ? (int) $rewardId : null)) {
                        $sentCount++;
                    }
                }
            }
        }

        // 3. Process specific customer IDs
        if (! empty($customerIds)) {
            $customers = User::whereIn('id', $customerIds)->get();
            foreach ($customers as $cust) {
                if (! $cust->email || in_array(strtolower($cust->email), $processedEmails, true)) {
                    continue;
                }
                $processedEmails[] = strtolower($cust->email);

                // Find latest qualifying paid order for customer
                $order = Order::where('user_id', $cust->id)
                    ->where(function ($q) {
                        $q->where('payment_status', PaymentStatus::PAID)
                          ->orWhere('payment_status', 'paid');
                    })
                    ->latest()
                    ->first();

                if ($order) {
                    $rewardId = $rewardAssignments['customers'][$cust->id]
                        ?? $rewardAssignments['orders'][$order->id]
                        ?? $assignedRewardId;
                    if ($this->sendSpinInvitationForOrder($order, $subject, $headline, $message, $rewardId ? (int) $rewardId : null)) {
                        $sentCount++;
                    }
                } else {
                    $rewardId = $rewardAssignments['customers'][$cust->id] ?? $assignedRewardId;
                    if ($this->sendStandaloneSpinInvitation($cust->email, $cust->name, $cust->id, $rewardId ? (int) $rewardId : null, $subject, $headline, $message)) {
                        $sentCount++;
                    }
                }
            }
        }

        // 4. Process marketing contact IDs if provided
        if (! empty($contactIds)) {
            $contacts = \App\Models\MarketingContact::whereIn('id', $contactIds)->get();
            foreach ($contacts as $contact) {
                if (! $contact->email || in_array(strtolower($contact->email), $processedEmails, true)) {
                    continue;
                }
                $processedEmails[] = strtolower($contact->email);
                $rewardId = $rewardAssignments['contacts'][$contact->id] ?? $assignedRewardId;
                if ($this->sendStandaloneSpinInvitation($contact->email, $contact->name, null, $rewardId ? (int) $rewardId : null, $subject, $headline, $message)) {
                    $sentCount++;
                }
            }
        }

        return [
            'sent_count' => $sentCount,
            'message' => "Spin & Win invitation sent to {$sentCount} recipient(s) successfully.",
        ];
    }

    private function sendStandaloneSpinInvitation(string $email, string $name, ?int $userId, ?int $rewardId, ?string $subject, ?string $headline, ?string $message): bool
    {
        $reward = $rewardId ? SpinReward::with('category')->whereKey($rewardId)->where('is_active', true)->first() : null;
        $segments = $this->getActiveSegments($reward?->category);
        if ($segments->count() < 2) {
            throw new RuntimeException('Configure at least two active rewards before sending invitations.');
        }
        if ($rewardId && ! $segments->contains('id', $rewardId)) {
            if (! $reward) {
                throw new InvalidArgumentException('Selected reward is not active.');
            }
        }
        if ($rewardId) {
            if (! $reward || ($reward->inventory !== null && $reward->inventory < 1)) {
                throw new InvalidArgumentException('The selected reward is out of stock.');
            }
        }
        $entitlement = OrderSpinEntitlement::create([
            'order_id' => null,
            'user_id' => $userId,
            'email' => $email,
            'name' => $name,
            'assigned_reward_id' => $rewardId,
            'spin_token' => Str::random(48),
            'status' => 'eligible',
        ]);
        $frontendUrl = rtrim(config('app.frontend_url', config('app.url', 'http://localhost:3000')), '/');
        $spinUrl = "{$frontendUrl}/rewards/spin?token={$entitlement->spin_token}";

        Log::info("Sending standalone spin wheel invitation to {$email}");

        try {
            Mail::to($email)->send(new SpinWheelInvitationMail(
                customerName: $name ?: 'Valued Customer',
                spinUrl: $spinUrl,
                orderNumber: null,
                customSubject: $subject,
                customHeadline: $headline,
                customMessage: $message
            ));
        } catch (\Throwable $exception) {
            $entitlement->delete();
            Log::error("Failed to send standalone spin wheel invitation to {$email}: " . $exception->getMessage());
            throw $exception;
        }
        return true;
    }
}
