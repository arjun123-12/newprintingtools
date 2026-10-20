<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderReviewLink;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderProductionAndShippingWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Order $order;
    protected OrderReviewLink $reviewLink;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->adminUser = User::create([
            'name' => 'Alice Admin',
            'email' => 'alice_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
            'is_super_admin' => true,
        ]);

        $this->customerUser = User::create([
            'name' => 'John Customer',
            'email' => 'john_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => User::ROLE_CUSTOMER,
        ]);

        $this->order = Order::create([
            'order_number' => 'MO-' . random_int(100000, 999999),
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::APPROVED,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'discount_amount' => 0.00,
            'total_inc_gst' => 110.00,
            'currency' => 'AUD',
            'shipping_address' => [
                'name' => 'John Customer',
                'email' => $this->customerUser->email,
                'address_line_1' => '100 Collins St',
                'city' => 'Melbourne',
                'state' => 'VIC',
                'postcode' => '3000',
            ],
            'billing_address' => [
                'name' => 'John Customer',
                'email' => $this->customerUser->email,
                'address_line_1' => '100 Collins St',
                'city' => 'Melbourne',
                'state' => 'VIC',
                'postcode' => '3000',
            ],
        ]);

        $this->reviewLink = OrderReviewLink::create([
            'order_id' => $this->order->id,
            'token' => 'secure_tracking_token_' . uniqid(),
            'token_hash' => hash('sha256', 'hash_' . uniqid()),
            'status' => 'active',
            'expires_at' => now()->addDays(30),
            'created_by' => $this->adminUser->id,
        ]);
    }

    public function test_unauthenticated_status_update_is_blocked(): void
    {
        $response = $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'production_started',
        ]);

        $response->assertStatus(401);
    }

    public function test_admin_can_update_status_and_audit_history_is_recorded(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'production_started',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'production_started',
                    'status_label' => 'Production started',
                ],
            ]);

        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'production_started',
        ]);

        $this->assertDatabaseHas('order_activities', [
            'order_id' => $this->order->id,
            'event_type' => 'order_status_updated',
            'actor_type' => 'staff',
            'actor_id' => $this->adminUser->id,
        ]);

        Mail::assertSentCount(1);
    }

    public function test_updating_same_status_does_not_send_duplicate_email(): void
    {
        Sanctum::actingAs($this->adminUser);

        // First change
        $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'cutting_in_progress',
        ])->assertStatus(200);

        Mail::assertSentCount(1);

        // Same status repeated
        $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'cutting_in_progress',
        ])->assertStatus(200);

        // Still 1 email!
        Mail::assertSentCount(1);
    }

    public function test_handed_over_to_courier_requires_carrier_and_tracking_number(): void
    {
        Sanctum::actingAs($this->adminUser);

        $response = $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'handed_over_to_courier',
            'carrier' => '',
            'tracking_number' => '',
        ]);

        $response->assertStatus(422);
    }

    public function test_handed_over_to_courier_saves_shipping_and_customer_can_view_safe_tracking_url_and_history(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Progress status through workflow
        $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'production_started',
        ])->assertStatus(200);

        $this->postJson("/api/v1/admin/manual-orders/{$this->order->id}/production-status", [
            'status' => 'handed_over_to_courier',
            'carrier' => 'Australia Post',
            'tracking_number' => 'AP987654321',
        ])->assertStatus(200);

        // Customer views public review/tracking portal
        $customerResponse = $this->getJson("/api/v1/order-review/{$this->reviewLink->token}");

        $customerResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'handed_over_to_courier',
                    'status_label' => 'Handed over to courier',
                    'shipping_carrier' => 'Australia Post',
                    'tracking_number' => 'AP987654321',
                    'carrier_tracking_url' => 'https://auspost.com.au/mypost/track/#/details/AP987654321',
                ],
            ]);

        $data = $customerResponse->json('data');
        $this->assertNotEmpty($data['status_history']);
        $this->assertIsArray($data['status_history']);
    }
}
