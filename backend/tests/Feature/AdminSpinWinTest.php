<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Order;
use App\Models\OrderSpinEntitlement;
use App\Models\CustomerRewardLedger;
use App\Models\SpinReward;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminSpinWinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpinRewardSeeder::class);
    }

    public function test_admin_can_view_and_update_spin_win_settings(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);

        // Get settings
        $response = $this->actingAs($admin)->getJson('/api/v1/admin/spin-win/settings');
        $response->assertStatus(200);
        $this->assertTrue($response->json('data.settings.enabled'));
        $this->assertGreaterThanOrEqual(8, count($response->json('data.segments')));

        // Update settings
        $updateRes = $this->actingAs($admin)->putJson('/api/v1/admin/spin-win/settings', [
            'enabled' => true,
            'min_order_spend' => 50.00,
            'banner_title' => 'SPIN & WIN PREMIUM',
            'banner_subtitle' => 'Exclusive Printing Rewards',
            'banner_tagline' => 'Test Tagline',
            'segments' => [
                [
                    'code' => '100_business_cards_free',
                    'title' => '100 Business Cards Special',
                    'reward_type' => 'free_product',
                    'badge_text' => 'FREE',
                    'value' => 45.00,
                    'terms_text' => 'Special terms',
                    'how_to_use' => 'How to use note',
                    'color_bg' => '#e0f2fe',
                    'color_text' => '#0369a1',
                    'probability_weight' => 20,
                    'min_order_spend' => 50.00,
                    'expiry_days' => 60,
                    'is_active' => true,
                    'sort_order' => 1,
                ]
            ]
        ]);

        $updateRes->assertStatus(200);
        $this->assertDatabaseHas('spin_rewards', [
            'code' => '100_business_cards_free',
            'title' => '100 Business Cards Special',
            'probability_weight' => 20,
        ]);
    }

    public function test_admin_ledger_search_and_customer_credit_balances(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create(['name' => 'Reward Ledger Customer']);
        $order = Order::create([
            'order_number' => 'PO-REWARD-LEDGER',
            'user_id' => $customer->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal_ex_gst' => 100,
            'gst_amount' => 10,
            'shipping_fee_inc_gst' => 0,
            'total_inc_gst' => 110,
            'shipping_address' => ['name' => $customer->name],
            'billing_address' => ['name' => $customer->name],
        ]);
        $spinReward = SpinReward::query()->firstOrFail();
        $entitlement = OrderSpinEntitlement::create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'email' => $customer->email,
            'name' => $customer->name,
            'spin_token' => 'test-ledger-token',
            'status' => 'spun',
        ]);
        CustomerRewardLedger::create([
            'entitlement_id' => $entitlement->id,
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'spin_reward_id' => $spinReward->id,
            'category_id' => $spinReward->category_id,
            'category_name' => 'Default',
            'reward_code' => 'SPIN-TEST-LEDGER',
            'reward_type' => 'print_credit',
            'title' => 'AUD $25 Print Credit',
            'value' => 25,
            'terms' => 'Test terms',
            'how_to_use' => 'Apply at checkout',
            'expires_at' => now()->addDays(10),
            'status' => 'active',
        ]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/spin-win/ledger?search=Reward%20Ledger%20Customer&status=active');

        $response->assertOk()
            ->assertJsonPath('data.data.0.reward_code', 'SPIN-TEST-LEDGER')
            ->assertJsonPath('data.print_credit_balances.0.user_id', $customer->id)
            ->assertJsonPath('data.print_credit_balances.0.balance', 25);
    }

    public function test_expiring_active_reward_sends_one_reminder_and_marks_it_sent(): void
    {
        $customer = User::factory()->create();
        $order = Order::create([
            'order_number' => 'PO-REWARD-EXPIRY',
            'user_id' => $customer->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal_ex_gst' => 100,
            'gst_amount' => 10,
            'shipping_fee_inc_gst' => 0,
            'total_inc_gst' => 110,
            'shipping_address' => ['name' => $customer->name],
            'billing_address' => ['name' => $customer->name],
        ]);
        $spinReward = SpinReward::query()->firstOrFail();
        $entitlement = OrderSpinEntitlement::create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'email' => $customer->email,
            'name' => $customer->name,
            'spin_token' => 'test-expiry-reminder-token',
            'status' => 'spun',
        ]);
        $ledger = CustomerRewardLedger::create([
            'entitlement_id' => $entitlement->id,
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'spin_reward_id' => $spinReward->id,
            'category_id' => $spinReward->category_id,
            'category_name' => 'Default',
            'reward_code' => 'SPIN-TEST-EXPIRING',
            'reward_type' => 'print_credit',
            'title' => 'AUD $25 Print Credit',
            'value' => 25,
            'terms' => 'Test terms',
            'how_to_use' => 'Apply at checkout',
            'expires_at' => now()->addDays(2),
            'status' => 'active',
        ]);

        Mail::fake();
        $this->artisan('rewards:send-expiry-reminders')->assertExitCode(0);

        $this->assertNotNull($ledger->fresh()->expiry_reminder_sent_at);
    }
}
