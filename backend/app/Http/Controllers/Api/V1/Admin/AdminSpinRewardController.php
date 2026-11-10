<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\CustomerRewardLedger;
use App\Models\MarketingContact;
use App\Models\Order;
use App\Models\OrderSpinEntitlement;
use App\Models\SpinReward;
use App\Models\SpinRewardCategory;
use App\Models\SpinWinSetting;
use App\Models\User;
use App\Services\Rewards\SpinRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class AdminSpinRewardController extends Controller
{
    public function storeCampaignRecipient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255'],
            'confirm_consent' => ['required', 'accepted'],
        ]);
        $email = Str::lower(trim($data['email']));
        $existingUser = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if ($existingUser) {
            $existingUser->update(['marketing_consent' => true]);
        }
        $recipient = MarketingContact::updateOrCreate(['email' => $email], [
            'name' => trim($data['name']) ?: ($existingUser?->name ?? 'Valued Customer'),
            'marketing_consent' => true,
            'marketing_consent_at' => now(),
            'unsubscribed_at' => null,
            'created_by' => $request->user()->id,
        ]);
        return response()->json([
            'success' => true,
            'message' => $existingUser ? 'Recipient verified as registered customer account.' : 'Contact added successfully.',
            'data' => $recipient,
        ], $recipient->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Get platform settings, all reward categories, and configured wheel segments.
     */
    public function getSettings(): JsonResponse
    {
        $settings = [
            'enabled' => (bool) SpinWinSetting::get('enabled', true),
            'min_order_spend' => (float) SpinWinSetting::get('min_order_spend', 0.00),
            'banner_title' => (string) SpinWinSetting::get('banner_title', 'SPIN & WIN'),
            'banner_subtitle' => (string) SpinWinSetting::get('banner_subtitle', 'AMAZING PRINTING REWARDS AWAIT!'),
            'banner_tagline' => (string) SpinWinSetting::get('banner_tagline', 'Play the wheel and unlock exciting rewards for your business.'),
            'proof_watermark_opacity' => (int) SpinWinSetting::get('proof_watermark_opacity', 40),
            'order_cutoff_time' => (string) SpinWinSetting::get('order_cutoff_time', '10:00'),
            'order_cutoff_timezone' => (string) SpinWinSetting::get('order_cutoff_timezone', 'Australia/Adelaide'),
            'auto_send_on_payment' => (bool) SpinWinSetting::get('auto_send_on_payment', true),
            'invitation_subject' => (string) SpinWinSetting::get('invitation_subject', '🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints'),
            'invitation_headline' => (string) SpinWinSetting::get('invitation_headline', "You've Unlocked a Free Spin!"),
            'invitation_message' => (string) SpinWinSetting::get('invitation_message', "Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credits, and free delivery upgrades on your next order."),
        ];

        $categories = SpinRewardCategory::query()
            ->withCount('rewards')
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $segments = SpinReward::query()
            ->with('category')
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $stats = [
            'total_spins' => OrderSpinEntitlement::where('status', 'spun')->count(),
            'total_rewards_issued' => CustomerRewardLedger::count(),
            'total_active_vouchers' => CustomerRewardLedger::where('status', 'active')->count(),
            'total_redeemed' => CustomerRewardLedger::where('status', 'redeemed')->count(),
            'total_categories' => $categories->count(),
            'active_categories' => $categories->where('is_active', true)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $settings,
                'categories' => $categories,
                'segments' => $segments,
                'stats' => $stats,
            ],
        ]);
    }

    /**
     * Update platform settings and reward segments across categories.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'min_order_spend' => ['required', 'numeric', 'min:0'],
            'auto_send_on_payment' => ['nullable', 'boolean'],
            'invitation_subject' => ['nullable', 'string', 'max:180'],
            'invitation_headline' => ['nullable', 'string', 'max:180'],
            'invitation_message' => ['nullable', 'string', 'max:5000'],
            'banner_title' => ['nullable', 'string', 'max:100'],
            'banner_subtitle' => ['nullable', 'string', 'max:150'],
            'banner_tagline' => ['nullable', 'string', 'max:255'],
            'proof_watermark_opacity' => ['sometimes', 'integer', 'between:0,100'],
            'order_cutoff_time' => ['sometimes', 'date_format:H:i'],
            'order_cutoff_timezone' => ['sometimes', 'timezone'],
            'segments' => ['nullable', 'array'],
            'segments.*.id' => ['nullable', 'integer'],
            'segments.*.category_id' => ['nullable', 'integer', 'exists:spin_reward_categories,id'],
            'segments.*.code' => ['required', 'string', 'max:64'],
            'segments.*.title' => ['required', 'string', 'max:100'],
            'segments.*.reward_type' => ['required', 'string', 'in:print_credit,free_product,premium_upgrade,shipping_upgrade'],
            'segments.*.badge_text' => ['nullable', 'string', 'max:32'],
            'segments.*.value' => ['required', 'numeric', 'min:0'],
            'segments.*.description' => ['nullable', 'string'],
            'segments.*.terms_text' => ['required', 'string'],
            'segments.*.how_to_use' => ['required', 'string'],
            'segments.*.color_bg' => ['required', 'string', 'max:32'],
            'segments.*.color_text' => ['nullable', 'string', 'max:32'],
            'segments.*.probability_weight' => ['required', 'integer', 'min:1'],
            'segments.*.inventory' => ['nullable', 'integer', 'min:0'],
            'segments.*.min_order_spend' => ['nullable', 'numeric', 'min:0'],
            'segments.*.expiry_days' => ['required', 'integer', 'min:1'],
            'segments.*.is_active' => ['required', 'boolean'],
            'segments.*.sort_order' => ['nullable', 'integer'],
        ]);

        if (array_key_exists('segments', $validated)) {
            $defaultCategoryId = SpinRewardCategory::where('is_default', true)->value('id');
            $activeSegmentsByCategory = collect($validated['segments'] ?? [])
                ->filter(fn (array $segment) => (bool) ($segment['is_active'] ?? false))
                ->groupBy(fn (array $segment) => $segment['category_id'] ?? $defaultCategoryId ?? 'default');
            foreach ($activeSegmentsByCategory as $categorySegments) {
                if ($categorySegments->count() < 2) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'segments' => ['Each category with active rewards must have at least 2 active wheel rewards.'],
                    ]);
                }
            }
        }

        SpinWinSetting::set('enabled', $validated['enabled']);
        SpinWinSetting::set('min_order_spend', (float) $validated['min_order_spend']);
        if (array_key_exists('auto_send_on_payment', $validated)) {
            SpinWinSetting::set('auto_send_on_payment', (bool) $validated['auto_send_on_payment']);
        }
        if (isset($validated['invitation_subject'])) {
            SpinWinSetting::set('invitation_subject', $validated['invitation_subject']);
        }
        if (isset($validated['invitation_headline'])) {
            SpinWinSetting::set('invitation_headline', $validated['invitation_headline']);
        }
        if (isset($validated['invitation_message'])) {
            SpinWinSetting::set('invitation_message', $validated['invitation_message']);
        }
        if (isset($validated['banner_title'])) {
            SpinWinSetting::set('banner_title', $validated['banner_title']);
        }
        if (isset($validated['banner_subtitle'])) {
            SpinWinSetting::set('banner_subtitle', $validated['banner_subtitle']);
        }
        if (isset($validated['banner_tagline'])) {
            SpinWinSetting::set('banner_tagline', $validated['banner_tagline']);
        }
        if (array_key_exists('proof_watermark_opacity', $validated)) {
            SpinWinSetting::set('proof_watermark_opacity', $validated['proof_watermark_opacity']);
        }
        if (array_key_exists('order_cutoff_time', $validated)) {
            SpinWinSetting::set('order_cutoff_time', $validated['order_cutoff_time']);
        }
        if (array_key_exists('order_cutoff_timezone', $validated)) {
            SpinWinSetting::set('order_cutoff_timezone', $validated['order_cutoff_timezone']);
        }

        // Get or default category
        $defaultCat = SpinRewardCategory::where('is_default', true)->first();

        if (! empty($validated['segments'])) {
            foreach ($validated['segments'] as $segData) {
                $code = $segData['code'];
                $catId = ! empty($segData['category_id']) ? (int) $segData['category_id'] : $defaultCat?->id;

                SpinReward::updateOrCreate(
                    ['code' => $code],
                    [
                        'category_id' => $catId,
                        'title' => $segData['title'],
                        'reward_type' => $segData['reward_type'],
                        'badge_text' => $segData['badge_text'] ?? null,
                        'value' => $segData['value'],
                        'description' => $segData['description'] ?? null,
                        'terms_text' => $segData['terms_text'],
                        'how_to_use' => $segData['how_to_use'],
                        'color_bg' => $segData['color_bg'],
                        'color_text' => $segData['color_text'] ?? '#0f172a',
                        'probability_weight' => $segData['probability_weight'],
                        'inventory' => isset($segData['inventory']) && $segData['inventory'] !== '' ? (int) $segData['inventory'] : null,
                        'min_order_spend' => $segData['min_order_spend'] ?? 0.00,
                        'expiry_days' => $segData['expiry_days'],
                        'is_active' => $segData['is_active'],
                        'sort_order' => $segData['sort_order'] ?? 1,
                    ]
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Spin & Win reward configuration updated successfully.',
        ]);
    }

    /**
     * List all reward categories with statistics.
     */
    public function listCategories(): JsonResponse
    {
        $categories = SpinRewardCategory::query()
            ->withCount('rewards')
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Store a new reward category.
     */
    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:64', 'unique:spin_reward_categories,code'],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', 'string', 'max:64'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $code = ! empty($validated['code'])
            ? Str::slug($validated['code'])
            : Str::slug($validated['name']);

        // Check if code collision
        if (SpinRewardCategory::where('code', $code)->exists()) {
            $code .= '-' . Str::random(4);
        }

        $isDefault = (bool) ($validated['is_default'] ?? false);
        if ($isDefault) {
            // Unset previous default
            SpinRewardCategory::where('is_default', true)->update(['is_default' => false]);
        }

        $category = SpinRewardCategory::create([
            'name' => $validated['name'],
            'code' => $code,
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? 'tag',
            'is_default' => $isDefault,
            'is_active' => $validated['is_active'],
            'sort_order' => $validated['sort_order'] ?? (SpinRewardCategory::count() + 1),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Category '{$category->name}' created successfully.",
            'data' => $category,
        ], 201);
    }

    /**
     * Update an existing reward category.
     */
    public function updateCategory(Request $request, int $id): JsonResponse
    {
        $category = SpinRewardCategory::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:64', "unique:spin_reward_categories,code,{$id}"],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', 'string', 'max:64'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $isDefault = isset($validated['is_default']) ? (bool) $validated['is_default'] : $category->is_default;
        if ($isDefault && ! $category->is_default) {
            SpinRewardCategory::where('is_default', true)->where('id', '!=', $category->id)->update(['is_default' => false]);
        } elseif (! $isDefault && $category->is_default) {
            // Prevent un-defaulting if no other default exists
            $otherDefault = SpinRewardCategory::where('is_default', true)->where('id', '!=', $category->id)->exists();
            if (! $otherDefault) {
                return response()->json([
                    'success' => false,
                    'message' => 'At least one default reward category must remain active as the system fallback.',
                ], 422);
            }
        }

        $code = ! empty($validated['code'])
            ? Str::slug($validated['code'])
            : $category->code;

        $category->update([
            'name' => $validated['name'],
            'code' => $code,
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? $category->icon,
            'is_default' => $isDefault,
            'is_active' => $validated['is_active'],
            'sort_order' => $validated['sort_order'] ?? $category->sort_order,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Category '{$category->name}' updated successfully.",
            'data' => $category->fresh(),
        ]);
    }

    /**
     * Safely delete a reward category.
     * Prevents deleting the Default category.
     * Automatically migrates associated rewards to the Default category before deletion.
     */
    public function deleteCategory(int $id): JsonResponse
    {
        $category = SpinRewardCategory::findOrFail($id);

        if ($category->is_default || $category->code === 'default') {
            return response()->json([
                'success' => false,
                'message' => 'The Default category cannot be deleted as it is required as the universal system fallback.',
            ], 422);
        }

        $defaultCat = SpinRewardCategory::where('is_default', true)->first()
            ?? SpinRewardCategory::where('code', 'default')->first();

        // Migrate all rewards under this category to Default category so no data is lost
        $rewardsCount = $category->rewards()->count();
        if ($rewardsCount > 0 && $defaultCat) {
            SpinReward::where('category_id', $category->id)
                ->update(['category_id' => $defaultCat->id]);
        }

        $categoryName = $category->name;
        $category->delete(); // Soft delete

        return response()->json([
            'success' => true,
            'message' => "Category '{$categoryName}' deleted safely. " . ($rewardsCount > 0 ? "({$rewardsCount} rewards reassigned to {$defaultCat->name})" : ''),
        ]);
    }

    /**
     * Delete an individual reward segment.
     */
    public function deleteReward(int $id): JsonResponse
    {
        $reward = SpinReward::findOrFail($id);

        // Keep at least two outcomes so the wheel remains meaningful.
        $activeInCategory = SpinReward::where('category_id', $reward->category_id)
            ->where('is_active', true)
            ->count();
        if ($reward->is_active && $activeInCategory <= 2) {
            return response()->json([
                'success' => false,
                'message' => 'Each category must keep at least 2 active wheel rewards. Deactivate this reward or add another reward first.',
            ], 422);
        }

        $reward->delete();

        return response()->json([
            'success' => true,
            'message' => 'Reward segment deleted successfully.',
        ]);
    }

    /**
     * View the durable ledger of all spins and issued rewards.
     */
    public function getLedger(Request $request): JsonResponse
    {
        $query = CustomerRewardLedger::query()
            ->with([
                'order:id,order_number,total_inc_gst,payment_status',
                'user:id,name,email,business_category',
                'category',
                'spinReward:id,code,title,reward_type,category_id',
            ])
            ->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reward_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('category_name', 'like', "%{$search}%")
                    ->orWhereHas('order', fn ($oq) => $oq->where('order_number', 'like', "%{$search}%"))
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            if ($status === 'expired') {
                $query->where('status', 'active')->whereNotNull('expires_at')->where('expires_at', '<=', now());
            } elseif ($status === 'active') {
                $query->where('status', 'active')->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                });
            } else {
                $query->where('status', $status);
            }
        }

        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }

        $ledger = $query->paginate(20);
        $printCreditBalances = CustomerRewardLedger::query()
            ->selectRaw('user_id, SUM(value) as balance, COUNT(*) as reward_count')
            ->where('status', 'active')
            ->where('reward_type', 'print_credit')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->with('user:id,name,email')
            ->orderByDesc('balance')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                ...$ledger->toArray(),
                'print_credit_balances' => $printCreditBalances->map(fn ($row) => [
                    'user_id' => $row->user_id,
                    'name' => $row->user?->name ?? 'Customer',
                    'email' => $row->user?->email,
                    'balance' => (float) $row->balance,
                    'reward_count' => (int) $row->reward_count,
                ])->values(),
            ],
        ]);
    }

    /**
     * Get order customers regardless of payment status, registered customer accounts, and marketing contacts.
     */
    public function getCampaignRecipients(): JsonResponse
    {
        $orders = Order::query()
            ->with(['user:id,name,email,company_name', 'spinEntitlement:id,order_id,status,spun_at'])
            ->latest('created_at')
            ->take(100)
            ->get()
            ->map(function ($o) {
                $shipping = is_array($o->shipping_address) ? $o->shipping_address : (json_decode($o->shipping_address ?? '[]', true) ?: []);
                $billing = is_array($o->billing_address) ? $o->billing_address : (json_decode($o->billing_address ?? '[]', true) ?: []);
                $name = $shipping['name'] ?? $billing['name'] ?? $o->user?->name ?? 'Customer';
                $email = $shipping['email'] ?? $billing['email'] ?? $o->user?->email;

                return [
                    'order_id' => $o->id,
                    'order_number' => $o->order_number,
                    'customer_id' => $o->user_id,
                    'name' => $name,
                    'email' => $email,
                    'total' => $o->total_inc_gst ?? $o->total,
                    'payment_status' => $o->payment_status instanceof PaymentStatus ? $o->payment_status->value : (string) $o->payment_status,
                    'has_spun' => $o->spinEntitlement?->status === 'spun',
                    'spun_at' => $o->spinEntitlement?->spun_at?->toIso8601String(),
                    'created_at' => $o->created_at->toIso8601String(),
                ];
            });

        $customers = User::query()
            ->where(function ($q) {
                $q->where('role', 'customer')
                  ->orWhereNull('role');
            })
            ->whereNotNull('email')
            ->whereNull('marketing_unsubscribed_at')
            ->orderBy('name')
            ->take(100)
            ->get(['id', 'name', 'email', 'company_name', 'marketing_consent']);

        $contacts = MarketingContact::query()
            ->whereNull('unsubscribed_at')
            ->orderBy('name')
            ->take(100)
            ->get(['id', 'name', 'email']);

        return response()->json([
            'success' => true,
            'data' => [
                'orders' => $orders,
                'paid_orders' => $orders,
                'customers' => $customers,
                'contacts' => $contacts,
            ],
        ]);
    }

    /**
     * Send Spin Wheel promotional invitation email campaign.
     */
    public function sendInvitation(Request $request, SpinRewardService $spinRewardService): JsonResponse
    {
        $mailer = config('mail.default');
        if (! $mailer || in_array($mailer, ['log', 'array'], true) || ! config("mail.mailers.{$mailer}")) {
            return response()->json([
                'success' => false,
                'message' => 'Email delivery is not configured. Set a real backend mail transport (MAIL_MAILER=smtp) before sending invitations.',
            ], 503);
        }

        $validated = $request->validate([
            'customer_ids' => ['nullable', 'array'],
            'order_ids' => ['nullable', 'array'],
            'contact_ids' => ['nullable', 'array'],
            'all_paid' => ['nullable', 'boolean'],
            'all_orders' => ['nullable', 'boolean'],
            'subject' => ['nullable', 'string', 'max:180'],
            'headline' => ['nullable', 'string', 'max:180'],
            'message' => ['nullable', 'string', 'max:5000'],
            'reward_id' => ['nullable', 'integer', 'exists:spin_rewards,id'],
            'reward_assignments' => ['nullable', 'array'],
            'reward_assignments.orders' => ['nullable', 'array'],
            'reward_assignments.orders.*' => ['nullable', 'integer', 'exists:spin_rewards,id'],
            'reward_assignments.customers' => ['nullable', 'array'],
            'reward_assignments.customers.*' => ['nullable', 'integer', 'exists:spin_rewards,id'],
            'reward_assignments.contacts' => ['nullable', 'array'],
            'reward_assignments.contacts.*' => ['nullable', 'integer', 'exists:spin_rewards,id'],
        ]);

        $assignedRewardId = (!empty($validated['reward_id']) && is_numeric($validated['reward_id']))
            ? (int) $validated['reward_id']
            : null;

        try {
            $result = $spinRewardService->sendPromotionalSpinInvitations(
                customerIds: $validated['customer_ids'] ?? [],
                orderIds: $validated['order_ids'] ?? [],
                contactIds: $validated['contact_ids'] ?? [],
                allPaid: (bool) ($validated['all_paid'] ?? false),
                allOrders: (bool) ($validated['all_orders'] ?? false),
                subject: $validated['subject'] ?? null,
                headline: $validated['headline'] ?? null,
                message: $validated['message'] ?? null,
                assignedRewardId: $assignedRewardId,
                rewardAssignments: $validated['reward_assignments'] ?? []
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        } catch (TransportExceptionInterface $exception) {
            report($exception);
            return response()->json([
                'success' => false,
                'message' => 'SMTP did not accept the email. Check the backend mail transport settings and try again.',
            ], 502);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json([
                'success' => false,
                'message' => 'The invitation could not be processed: ' . $exception->getMessage(),
            ], 500);
        }

        if (($result['sent_count'] ?? 0) < 1) {
            return response()->json([
                'success' => false,
                'message' => 'No emails were sent. Select at least one eligible recipient with an email address.',
                'data' => $result,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => $result,
        ]);
    }
}
