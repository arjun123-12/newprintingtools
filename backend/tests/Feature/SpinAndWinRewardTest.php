<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\CustomerRewardLedger;
use App\Models\Order;
use App\Models\OrderSpinEntitlement;
use App\Models\Payment;
use App\Models\SpinReward;
use App\Models\User;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SpinAndWinRewardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpinRewardSeeder::class);
    }

    public function test_unpaid_order_is_not_eligible_for_spin(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'order_number' => 'PO-TEST-UNPAID',
            'user_id' => $user->id,
            'status' => OrderStatus::PENDING_PAYMENT,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'shipping_address' => ['name' => 'John'],
            'billing_address' => ['name' => 'John'],
        ]);

        $response = $this->getJson('/api/v1/spin-win/eligibility?order_number=PO-TEST-UNPAID');

        $response->assertStatus(200);
        $this->assertFalse($response->json('data.eligible'));
        $this->assertStringContainsString('Payment has not been completed', $response->json('data.reason'));
    }

    public function test_paid_order_is_eligible_and_creates_single_entitlement(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'order_number' => 'PO-TEST-PAID',
            'user_id' => $user->id,
            'status' => OrderStatus::PROCESSING,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'shipping_address' => ['name' => 'John'],
            'billing_address' => ['name' => 'John'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'bpoint',
            'transaction_id' => 'TXN-12345',
            'amount' => 110.00,
            'status' => 'succeeded',
        ]);

        $response = $this->getJson('/api/v1/spin-win/eligibility?order_number=PO-TEST-PAID');

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.eligible'));
        $this->assertFalse($response->json('data.has_spun'));
        $this->assertNotEmpty($response->json('data.spin_token'));
        $this->assertCount(8, $response->json('data.wheel_segments'));

        // Entitlement in DB
        $this->assertDatabaseHas('order_spin_entitlements', [
            'order_id' => $order->id,
            'status' => 'eligible',
        ]);
    }

    public function test_spin_selects_prize_server_side_and_is_idempotent(): void
    {
        $user = User::factory()->create();
        $order = Order::create([
            'order_number' => 'PO-TEST-SPIN',
            'user_id' => $user->id,
            'status' => OrderStatus::PROCESSING,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 150.00,
            'gst_amount' => 15.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 165.00,
            'shipping_address' => ['name' => 'Alice'],
            'billing_address' => ['name' => 'Alice'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'bpoint',
            'transaction_id' => 'TXN-67890',
            'amount' => 165.00,
            'status' => 'succeeded',
        ]);

        // 1. Get spin token
        $eligibilityRes = $this->getJson('/api/v1/spin-win/eligibility?order_number=PO-TEST-SPIN');
        $spinToken = $eligibilityRes->json('data.spin_token');

        // 2. Perform spin
        $spinRes = $this->actingAs($user)->postJson('/api/v1/spin-win/spin', [
            'order_number' => 'PO-TEST-SPIN',
            'spin_token' => $spinToken,
        ]);

        $spinRes->assertStatus(200);
        $this->assertTrue($spinRes->json('success'));
        $prize = $spinRes->json('data.prize');
        $this->assertNotNull($prize);
        $this->assertNotEmpty($prize['reward_code']);
        $this->assertIsInt($prize['segment_index']);
        $this->assertGreaterThanOrEqual(0, $prize['segment_index']);
        $this->assertLessThan(8, $prize['segment_index']);

        // Check DB ledger
        $this->assertDatabaseHas('customer_reward_ledgers', [
            'order_id' => $order->id,
            'reward_code' => $prize['reward_code'],
            'status' => 'active',
        ]);

        // Check entitlement updated
        $this->assertDatabaseHas('order_spin_entitlements', [
            'order_id' => $order->id,
            'status' => 'spun',
        ]);

        // 3. Retry / refresh spin (must be idempotent and return same prize)
        $retryRes = $this->actingAs($user)->postJson('/api/v1/spin-win/spin', [
            'order_number' => 'PO-TEST-SPIN',
            'spin_token' => $spinToken,
        ]);

        $retryRes->assertStatus(200);
        $this->assertEquals($prize['reward_code'], $retryRes->json('data.prize.reward_code'));
        $this->assertEquals(1, CustomerRewardLedger::where('order_id', $order->id)->count());

        // 4. Check customer rewards endpoint
        $custRewardsRes = $this->actingAs($user)->getJson('/api/v1/rewards/my-rewards');
        $custRewardsRes->assertStatus(200);
        $this->assertEquals(1, $custRewardsRes->json('data.rewards_count'));

        // 5. Test voucher validation for future checkout
        $valRes = $this->postJson('/api/v1/spin-win/validate-voucher', [
            'code' => $prize['reward_code'],
            'subtotal' => 100.00,
        ]);
        $valRes->assertStatus(200);
        $this->assertTrue($valRes->json('data.valid'));
        $this->assertEquals($prize['reward_code'], $valRes->json('data.reward_code'));
    }
}
