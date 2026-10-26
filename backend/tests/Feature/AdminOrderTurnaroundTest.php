<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOrderTurnaroundTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Manager',
            'email' => 'admin.turnaround_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
            'is_super_admin' => true,
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Joe',
            'email' => 'joe.customer_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => User::ROLE_CUSTOMER,
            'is_active' => true,
        ]);

        $category = \App\Models\Category::firstOrCreate(
            ['slug' => 'print-products'],
            ['name' => 'Print Products', 'is_active' => true]
        );

        $this->product = Product::firstOrCreate(
            ['slug' => 'business-cards'],
            [
                'category_id' => $category->id,
                'name' => 'Business Cards',
                'sku' => 'BC-100',
                'base_price' => 100.00,
            ]
        );
    }

    public function test_staff_can_create_order_with_turnaround_time(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'customer_id' => $this->customerUser->id,
            'customer_name' => 'Customer Joe',
            'customer_email' => $this->customerUser->email,
            'delivery_address' => '100 Flinders St, Melbourne VIC 3000',
            'turnaround_duration_value' => 3,
            'turnaround_duration_unit' => 'days',
            'turnaround_day_type' => 'business',
            'start_clock_now' => true,
            'items' => [
                [
                    'product_id' => (string) $this->product->id,
                    'product_name' => 'Business cards',
                    'quantity' => 500,
                    'price' => 75.00,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/admin/manual-orders', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $orderId = $response->json('data.id');
        $order = Order::find($orderId);

        $this->assertEquals(3, $order->turnaround_duration_value);
        $this->assertEquals('days', $order->turnaround_duration_unit);
        $this->assertEquals('business', $order->turnaround_day_type);
        $this->assertNotNull($order->turnaround_started_at);
        $this->assertNotNull($order->estimated_completion_at);
    }

    public function test_business_days_calculation_skips_weekends(): void
    {
        // Friday afternoon
        $friday = Carbon::parse('2026-10-23 14:00:00', 'Australia/Sydney');

        $order = new Order([
            'turnaround_duration_value' => 2,
            'turnaround_duration_unit' => 'days',
            'turnaround_day_type' => 'business',
            'order_cutoff_timezone' => 'Australia/Sydney',
        ]);

        $deadline = $order->calculateEstimatedCompletion($friday);

        // 2 business days from Friday 14:00 should be Tuesday 14:00
        $this->assertEquals('Tuesday', $deadline->format('l'));
        $this->assertEquals('2026-10-27 14:00:00', $deadline->format('Y-m-d H:i:s'));
    }

    public function test_hours_turnaround_calculation(): void
    {
        $startTime = Carbon::parse('2026-10-26 10:00:00', 'Australia/Sydney');

        $order = new Order([
            'turnaround_duration_value' => 24,
            'turnaround_duration_unit' => 'hours',
            'order_cutoff_timezone' => 'Australia/Sydney',
        ]);

        $deadline = $order->calculateEstimatedCompletion($startTime);

        $this->assertEquals('2026-10-27 10:00:00', $deadline->format('Y-m-d H:i:s'));
    }

    public function test_staff_can_update_turnaround_settings_via_api(): void
    {
        Sanctum::actingAs($this->adminUser);

        $order = Order::create([
            'order_number' => 'MO-888001',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::DRAFT,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100,
            'gst_amount' => 10,
            'shipping_fee_inc_gst' => 0,
            'total_inc_gst' => 110,
            'shipping_address' => ['email' => 'test@example.com'],
            'billing_address' => ['email' => 'test@example.com'],
        ]);

        $targetDate = now()->addDays(4)->toIso8601String();

        $response = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/turnaround", [
            'duration_value' => 4,
            'duration_unit' => 'days',
            'day_type' => 'business',
            'start_clock_now' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.turnaround_duration_value', 4)
            ->assertJsonPath('data.turnaround_duration_unit', 'days');

        $order->refresh();
        $this->assertEquals(4, $order->turnaround_duration_value);
        $this->assertNotNull($order->turnaround_started_at);
        $this->assertNotNull($order->estimated_completion_at);
    }

    public function test_turnaround_appears_in_admin_list_api(): void
    {
        Sanctum::actingAs($this->adminUser);

        $order = Order::create([
            'order_number' => 'MO-888002',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::IN_PRODUCTION,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 100,
            'gst_amount' => 10,
            'shipping_fee_inc_gst' => 0,
            'total_inc_gst' => 110,
            'shipping_address' => ['email' => 'test@example.com'],
            'billing_address' => ['email' => 'test@example.com'],
            'turnaround_duration_value' => 2,
            'turnaround_duration_unit' => 'days',
            'turnaround_day_type' => 'business',
            'turnaround_started_at' => now()->subDay(),
            'estimated_completion_at' => now()->addDay(),
        ]);

        $response = $this->getJson('/api/v1/admin/manual-orders');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $found = collect($response->json('data.data'))->firstWhere('order_number', 'MO-888002');
        $this->assertNotNull($found);
        $this->assertEquals(2, $found['turnaround_duration_value']);
        $this->assertNotNull($found['estimated_completion_at']);
        $this->assertNotNull($found['turnaround']);
    }

    public function test_unauthenticated_user_cannot_update_turnaround(): void
    {
        $order = Order::create([
            'order_number' => 'MO-888003',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::DRAFT,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100,
            'gst_amount' => 10,
            'shipping_fee_inc_gst' => 0,
            'total_inc_gst' => 110,
            'shipping_address' => ['email' => 'test@example.com'],
            'billing_address' => ['email' => 'test@example.com'],
        ]);

        $response = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/turnaround", [
            'duration_value' => 5,
        ]);

        $response->assertStatus(401);
    }
}
