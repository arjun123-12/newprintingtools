<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerRewardLedger;
use App\Models\OrderSpinEntitlement;
use App\Models\SpinReward;
use App\Models\SpinWinSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSpinRewardController extends Controller
{
    /**
     * Get platform settings and all configured wheel segments.
     */
    public function getSettings(): JsonResponse
    {
        $settings = [
            'enabled' => (bool) SpinWinSetting::get('enabled', true),
            'min_order_spend' => (float) SpinWinSetting::get('min_order_spend', 0.00),
            'banner_title' => (string) SpinWinSetting::get('banner_title', 'SPIN & WIN'),
            'banner_subtitle' => (string) SpinWinSetting::get('banner_subtitle', 'AMAZING PRINTING REWARDS AWAIT!'),
            'banner_tagline' => (string) SpinWinSetting::get('banner_tagline', 'Play the wheel and unlock exciting rewards for your business.'),
        ];

        $segments = SpinReward::query()
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $stats = [
            'total_spins' => OrderSpinEntitlement::where('status', 'spun')->count(),
            'total_rewards_issued' => CustomerRewardLedger::count(),
            'total_active_vouchers' => CustomerRewardLedger::where('status', 'active')->count(),
            'total_redeemed' => CustomerRewardLedger::where('status', 'redeemed')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $settings,
                'segments' => $segments,
                'stats' => $stats,
            ],
        ]);
    }

    /**
     * Update platform settings and reward segments.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'min_order_spend' => ['required', 'numeric', 'min:0'],
            'banner_title' => ['nullable', 'string', 'max:100'],
            'banner_subtitle' => ['nullable', 'string', 'max:150'],
            'banner_tagline' => ['nullable', 'string', 'max:255'],
            'segments' => ['nullable', 'array'],
            'segments.*.id' => ['nullable', 'integer'],
            'segments.*.code' => ['required', 'string', 'max:64'],
            'segments.*.title' => ['required', 'string', 'max:100'],
            'segments.*.reward_type' => ['required', 'string', 'in:print_credit,free_product,premium_upgrade,shipping_upgrade'],
            'segments.*.badge_text' => ['nullable', 'string', 'max:32'],
            'segments.*.value' => ['required', 'numeric', 'min:0'],
            'segments.*.terms_text' => ['required', 'string'],
            'segments.*.how_to_use' => ['required', 'string'],
            'segments.*.color_bg' => ['required', 'string', 'max:32'],
            'segments.*.color_text' => ['nullable', 'string', 'max:32'],
            'segments.*.probability_weight' => ['required', 'integer', 'min:1'],
            'segments.*.min_order_spend' => ['nullable', 'numeric', 'min:0'],
            'segments.*.expiry_days' => ['required', 'integer', 'min:1'],
            'segments.*.is_active' => ['required', 'boolean'],
            'segments.*.sort_order' => ['nullable', 'integer'],
        ]);

        SpinWinSetting::set('enabled', $validated['enabled']);
        SpinWinSetting::set('min_order_spend', (float) $validated['min_order_spend']);
        if (isset($validated['banner_title'])) {
            SpinWinSetting::set('banner_title', $validated['banner_title']);
        }
        if (isset($validated['banner_subtitle'])) {
            SpinWinSetting::set('banner_subtitle', $validated['banner_subtitle']);
        }
        if (isset($validated['banner_tagline'])) {
            SpinWinSetting::set('banner_tagline', $validated['banner_tagline']);
        }

        if (! empty($validated['segments'])) {
            foreach ($validated['segments'] as $segData) {
                $code = $segData['code'];
                SpinReward::updateOrCreate(
                    ['code' => $code],
                    [
                        'title' => $segData['title'],
                        'reward_type' => $segData['reward_type'],
                        'badge_text' => $segData['badge_text'] ?? null,
                        'value' => $segData['value'],
                        'terms_text' => $segData['terms_text'],
                        'how_to_use' => $segData['how_to_use'],
                        'color_bg' => $segData['color_bg'],
                        'color_text' => $segData['color_text'] ?? '#0f172a',
                        'probability_weight' => $segData['probability_weight'],
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
     * View the durable ledger of all spins and issued rewards.
     */
    public function getLedger(Request $request): JsonResponse
    {
        $query = CustomerRewardLedger::query()
            ->with([
                'order:id,order_number,total_inc_gst,payment_status',
                'user:id,name,email',
                'spinReward:id,code,title,reward_type',
            ])
            ->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reward_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhereHas('order', fn ($oq) => $oq->where('order_number', 'like', "%{$search}%"))
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $ledger = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $ledger,
        ]);
    }
}
