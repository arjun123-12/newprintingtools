<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Mail\SpinRewardWonMail;
use App\Models\CustomerRewardLedger;
use App\Models\Order;
use App\Models\OrderReviewLink;
use App\Models\OrderSpinEntitlement;
use App\Models\Payment;
use App\Models\SpinReward;
use App\Models\SpinRewardCategory;
use App\Models\User;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ManualOrderSpinWinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpinRewardSeeder::class);
    }

    /**
     * Helper to create a manual order.
     */
    protected function createManualOrder(
        string $orderNumber = 'PO-MANUAL-001',
        ?User $user = null,
        PaymentStatus $paymentStatus = PaymentStatus::UNPAID,
        float $total = 165.00,
        ?string $businessCategory = 'retail'
    ): Order {
        $user = $user ?? User::factory()->create();

        return Order::create([
            'order_number' => $orderNumber,
            'user_id' => $user->id,
            'source' => 'manual',
            'business_category' => $businessCategory,
            'status' => $paymentStatus === PaymentStatus::PAID ? OrderStatus::IN_PRODUCTION : OrderStatus::PENDING_PAYMENT,
            'payment_status' => $paymentStatus,
            'subtotal_ex_gst' => $total / 1.1,
            'gst_amount' => $total - ($total / 1.1),
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => $total,
            'shipping_address' => [
                'name' => 'Manual Customer',
                'address' => '123 Print St',
                'city' => 'Sydney',
                'state' => 'NSW',
                'postcode' => '2000',
            ],
            'billing_address' => [
                'name' => 'Manual Customer',
                'address' => '123 Print St',
                'city' => 'Sydney',
                'state' => 'NSW',
                'postcode' => '2000',
            ],
        ]);
    }

    /**
     * Helper to generate a review link for an order.
     */
    protected function createReviewLink(Order $order, string $status = 'active', ?\Carbon\Carbon $expiresAt = null): OrderReviewLink
    {
        $token = Str::random(48);

        return OrderReviewLink::create([
            'order_id' => $order->id,
            'token' => $token,
            'token_hash' => hash('sha256', $token),
            'status' => $status,
            'expires_at' => $expiresAt ?? now()->addDays(30),
            'revoked_at' => $status === 'revoked' ? now() : null,
        ]);
    }

    /**
     * Helper to add a succeeded Payment transaction record for genuine verification.
     */
    protected function addSucceededPayment(Order $order, float $amount = 165.00): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'gateway' => 'bpoint',
            'transaction_id' => 'BPOINT-TXN-' . Str::random(10),
            'receipt_number' => 'RCPT-' . Str::random(8),
            'amount' => $amount,
            'currency' => 'AUD',
            'status' => 'succeeded',
        ]);
    }

    public function test_guest_manual_order_customer_can_access_eligibility_via_token(): void
    {
        // Simulate a customer without an active login session. Manual orders still
        // have an internal customer record because orders.user_id is required.
        $order = $this->createManualOrder('PO-GUEST-001', null, PaymentStatus::PAID, 165.00, 'retail');
        $this->addSucceededPayment($order);
        $link = $this->createReviewLink($order);

        // 1. Access via dedicated order-review endpoint without any user session
        $response1 = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $response1->assertStatus(200);
        $this->assertTrue($response1->json('data.eligible'));
        $this->assertFalse($response1->json('data.has_spun'));
        $this->assertEquals('PO-GUEST-001', $response1->json('data.order_number'));
        $this->assertNotEmpty($response1->json('data.spin_token'));
        $this->assertNotEmpty($response1->json('data.wheel_segments'));
        $this->assertEquals('retail', $response1->json('data.category.code'));

        // 2. Access via general spin-win eligibility endpoint with review_token
        $response2 = $this->getJson("/api/v1/spin-win/eligibility?review_token={$link->token}");
        $response2->assertStatus(200);
        $this->assertTrue($response2->json('data.eligible'));
        $this->assertEquals('PO-GUEST-001', $response2->json('data.order_number'));
    }

    public function test_unpaid_manual_order_is_rejected_for_spin(): void
    {
        $order = $this->createManualOrder('PO-UNPAID-001', null, PaymentStatus::UNPAID);
        $link = $this->createReviewLink($order);

        // Check eligibility
        $response = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $response->assertStatus(200);
        $this->assertFalse($response->json('data.eligible'));
        $this->assertStringContainsString('Payment has not been completed or verified', $response->json('data.reason'));

        // Attempting to spin fails
        $spinResponse = $this->postJson("/api/v1/order-review/{$link->token}/spin", [
            'spin_token' => Str::random(48),
        ]);
        $spinResponse->assertStatus(422);
        $this->assertStringContainsString('Payment is not confirmed', $spinResponse->json('message'));
    }

    public function test_manually_changing_payment_status_without_succeeded_payment_record_is_rejected(): void
    {
        // Order has payment_status = PAID in the orders table, BUT NO payment gateway transaction record
        $order = $this->createManualOrder('PO-MANUAL-TAMPERED', null, PaymentStatus::PAID);
        $link = $this->createReviewLink($order);

        // Strictly verify that genuine backend transaction is enforced
        $response = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $response->assertStatus(200);
        $this->assertFalse($response->json('data.eligible'));
        $this->assertStringContainsString('Payment has not been completed or verified', $response->json('data.reason'));

        // Now attach a genuine succeeded payment record
        $this->addSucceededPayment($order);

        // Now it becomes eligible!
        $responseAfterPay = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $responseAfterPay->assertStatus(200);
        $this->assertTrue($responseAfterPay->json('data.eligible'));
    }

    public function test_token_and_order_number_mismatch_is_rejected(): void
    {
        $order1 = $this->createManualOrder('PO-ORDER-001', null, PaymentStatus::PAID);
        $this->addSucceededPayment($order1);
        $link1 = $this->createReviewLink($order1);

        $order2 = $this->createManualOrder('PO-ORDER-002', null, PaymentStatus::PAID);
        $this->addSucceededPayment($order2);

        // Providing token for order 1 with order_number for order 2
        $response = $this->getJson("/api/v1/spin-win/eligibility?review_token={$link1->token}&order_number=PO-ORDER-002");
        $response->assertStatus(422);
        $this->assertStringContainsString('Order number does not match', $response->json('message'));

        $spinResponse = $this->postJson('/api/v1/spin-win/spin', [
            'review_token' => $link1->token,
            'order_number' => 'PO-ORDER-002',
            'spin_token' => Str::random(48),
        ]);
        $spinResponse->assertStatus(422);
        $this->assertStringContainsString('Order number does not match', $spinResponse->json('message'));
    }

    public function test_revoked_or_expired_review_token_is_rejected(): void
    {
        $order = $this->createManualOrder('PO-REVOKED-001', null, PaymentStatus::PAID);
        $this->addSucceededPayment($order);

        // Revoked link
        $revokedLink = $this->createReviewLink($order, 'revoked');
        $responseRevoked = $this->getJson("/api/v1/order-review/{$revokedLink->token}/spin-eligibility");
        $responseRevoked->assertStatus(403);
        $this->assertStringContainsString('revoked', $responseRevoked->json('message'));

        // Expired link
        $expiredLink = $this->createReviewLink($order, 'active', now()->subDays(2));
        $responseExpired = $this->getJson("/api/v1/order-review/{$expiredLink->token}/spin-eligibility");
        $responseExpired->assertStatus(403);
        $this->assertStringContainsString('expired', $responseExpired->json('message'));

        // Inactive links must not grant reward access either.
        $inactiveLink = $this->createReviewLink($order, 'inactive');
        $responseInactive = $this->getJson("/api/v1/order-review/{$inactiveLink->token}/spin-eligibility");
        $responseInactive->assertStatus(403);
        $this->assertStringContainsString('inactive', $responseInactive->json('message'));
    }

    public function test_unauthenticated_request_using_only_order_number_is_rejected(): void
    {
        $order = $this->createManualOrder('PO-GUESSED-001', null, PaymentStatus::PAID);
        $this->addSucceededPayment($order);

        // Attempting to probe eligibility using only order_number without authentication and without review token
        $response = $this->getJson('/api/v1/spin-win/eligibility?order_number=PO-GUESSED-001');
        $response->assertStatus(403);
        $this->assertStringContainsString('Authentication or a valid tokenized review link is required', $response->json('message'));
    }

    public function test_manual_order_spin_persists_in_ledger_and_prevents_duplicate_spins(): void
    {
        Mail::fake();
        $order = $this->createManualOrder('PO-SPIN-PERSIST', null, PaymentStatus::PAID, 200.00, 'corporate');
        $this->addSucceededPayment($order);
        $link = $this->createReviewLink($order);

        // 1. Get initial spin token
        $eligibilityRes = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $eligibilityRes->assertStatus(200);
        $spinToken = $eligibilityRes->json('data.spin_token');
        $this->assertNotEmpty($spinToken);

        // 2. Execute spin via tokenized endpoint
        $spinRes = $this->postJson("/api/v1/order-review/{$link->token}/spin", [
            'spin_token' => $spinToken,
            'order_number' => 'PO-SPIN-PERSIST',
        ]);

        $spinRes->assertStatus(200);
        $this->assertTrue($spinRes->json('success'));
        $prize = $spinRes->json('data.prize');
        $this->assertNotNull($prize);
        $this->assertNotEmpty($prize['reward_code']);
        $this->assertStringStartsWith('SPIN-', $prize['reward_code']);

        // 3. Verify ledger persistence
        $this->assertDatabaseHas('customer_reward_ledgers', [
            'order_id' => $order->id,
            'reward_code' => $prize['reward_code'],
            'title' => $prize['title'],
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('order_spin_entitlements', [
            'order_id' => $order->id,
            'status' => 'spun',
        ]);

        $ledgerCount = CustomerRewardLedger::where('order_id', $order->id)->count();
        $this->assertEquals(1, $ledgerCount);
        Mail::assertSent(SpinRewardWonMail::class, function (SpinRewardWonMail $mail) use ($order, $prize) {
            return $mail->order->id === $order->id
                && $mail->reward->reward_code === $prize['reward_code']
                && $mail->hasTo($order->user->email);
        });

        // 4. Repeated spin call is idempotent and prevents duplicate rewards
        $repeatSpinRes = $this->postJson("/api/v1/order-review/{$link->token}/spin", [
            'spin_token' => $spinToken,
            'order_number' => 'PO-SPIN-PERSIST',
        ]);

        $repeatSpinRes->assertStatus(200);
        $this->assertTrue($repeatSpinRes->json('data.already_spun'));
        $this->assertEquals($prize['reward_code'], $repeatSpinRes->json('data.prize.reward_code'));

        // Ledger row count MUST remain 1
        $this->assertEquals(1, CustomerRewardLedger::where('order_id', $order->id)->count());
        Mail::assertSent(SpinRewardWonMail::class, 1);

        // 5. Subsequent eligibility request returns has_spun = true with the saved prize
        $refreshRes = $this->getJson("/api/v1/order-review/{$link->token}/spin-eligibility");
        $refreshRes->assertStatus(200);
        $this->assertTrue($refreshRes->json('data.has_spun'));
        $this->assertEquals($prize['reward_code'], $refreshRes->json('data.prize.reward_code'));
        $this->assertEquals($prize['title'], $refreshRes->json('data.prize.title'));
    }
}
