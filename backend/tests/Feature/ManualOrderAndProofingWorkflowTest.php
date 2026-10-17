<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Artwork;
use App\Models\ArtworkVersion;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderItem;
use App\Models\OrderReviewLink;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManualOrderAndProofingWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Storage::fake('public');

        $this->adminUser = User::create([
            'name' => 'Sarah Chen (Staff)',
            'email' => 'sarah.chen_' . uniqid() . '@printecommerce.com.au',
            'password' => 'secret123',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
            'is_super_admin' => true,
        ]);

        $this->customerUser = User::create([
            'name' => 'Studio Coffee Pty Ltd',
            'email' => 'hello.coffee_' . uniqid() . '@studiocoffee.com.au',
            'password' => 'secret123',
            'role' => User::ROLE_CUSTOMER,
            'company_name' => 'Studio Coffee Pty Ltd',
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
                'status' => 'active',
            ]
        );
    }

    public function test_unauthenticated_user_cannot_access_manual_orders(): void
    {
        $response = $this->getJson('/api/v1/admin/manual-orders');
        $response->assertStatus(401);
    }

    public function test_staff_can_calculate_order_totals_server_side(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'delivery_method' => 'Standard delivery (Free)',
            'items' => [
                [
                    'product_id' => (string) $this->product->id,
                    'quantity' => 1,
                    'unit_price_ex_gst' => 100.00,
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/admin/manual-orders/calculate', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.subtotal_ex_gst', 100)
            ->assertJsonPath('data.shipping_fee_inc_gst', 0)
            ->assertJsonPath('data.gst_amount', 10)
            ->assertJsonPath('data.total_inc_gst', 110);
    }

    public function test_staff_can_create_manual_order_draft(): void
    {
        Sanctum::actingAs($this->adminUser);

        $payload = [
            'customer_id' => $this->customerUser->id,
            'customer_name' => 'Studio Coffee Pty Ltd',
            'customer_email' => $this->customerUser->email,
            'customer_phone' => '0412345678',
            'company_name' => 'Studio Coffee Pty Ltd',
            'delivery_method' => 'Standard delivery (Free)',
            'delivery_address' => '12 Harper Lane, Richmond VIC 3121, Australia',
            'internal_notes' => 'Repeat customer. Brand color consistency check needed.',
            'customer_notes' => 'Please check all details carefully before approval.',
            'items' => [
                [
                    'product_id' => (string) $this->product->id,
                    'product_name' => 'Business cards',
                    'quantity' => 1000,
                    'price' => 100.00,
                    'specifications' => '90 x 55 mm, 350gsm Matte',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/admin/manual-orders', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.subtotal_ex_gst', '100.00')
            ->assertJsonPath('data.gst_amount', '10.00')
            ->assertJsonPath('data.total_inc_gst', '110.00');

        $orderId = $response->json('data.id');
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'draft',
            'payment_status' => 'unpaid',
        ]);

        $this->assertDatabaseHas('order_activities', [
            'order_id' => $orderId,
            'event_type' => 'draft_created',
        ]);
    }

    public function test_staff_can_upload_proof_files_and_versioning(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Create order
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::DRAFT,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
            'current_proof_version' => 1,
        ]);

        $frontFile = UploadedFile::fake()->create('STUDIO_COFFEE_BC_front.pdf', 2400, 'application/pdf');
        $backFile = UploadedFile::fake()->create('STUDIO_COFFEE_BC_back.pdf', 2300, 'application/pdf');

        // 1. Upload initial proof (V1)
        $uploadResp = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/proofs", [
            'files' => [$frontFile, $backFile],
            'version' => 1,
        ]);

        $uploadResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.version_number', 1);

        $this->assertDatabaseHas('artwork_versions', [
            'version_number' => 1,
        ]);

        // 2. Upload revision (V2)
        $revisedFront = UploadedFile::fake()->create('STUDIO_COFFEE_BC_front_v2.pdf', 2500, 'application/pdf');
        $uploadResp2 = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/proofs", [
            'files' => [$revisedFront],
            'version' => 2,
        ]);

        $uploadResp2->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.version_number', 2);

        $order->refresh();
        $this->assertEquals(2, $order->current_proof_version);
    }

    public function test_staff_can_send_for_approval_and_generate_secure_link(): void
    {
        Sanctum::actingAs($this->adminUser);

        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::DRAFT,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
            'current_proof_version' => 1,
        ]);

        $response = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/send-for-approval");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.order.status', 'artwork_review');

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);
        $this->assertEquals(48, strlen($token));

        $order->refresh();
        $this->assertEquals(OrderStatus::ARTWORK_REVIEW, $order->status);

        $this->assertDatabaseHas('order_review_links', [
            'order_id' => $order->id,
            'token' => $token,
            'status' => 'active',
        ]);
    }

    public function test_customer_can_view_proof_portal_without_leaking_internal_notes(): void
    {
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => [
                'name' => 'Studio Coffee Pty Ltd',
                'email' => $this->customerUser->email,
                'address_line_1' => '12 Harper Lane',
                'city' => 'Richmond',
                'state' => 'VIC',
                'postcode' => '3121',
            ],
            'billing_address' => ['email' => $this->customerUser->email],
            'admin_notes' => 'STRICTLY INTERNAL: VIP customer discount code applied internally.',
            'customer_notes' => 'Customer-facing: Please check phone number font size.',
            'current_proof_version' => 1,
        ]);

        $link = OrderReviewLink::create([
            'order_id' => $order->id,
            'token' => 'secure_sample_token_1234567890123456789012345678',
            'status' => 'active',
            'expires_at' => now()->addDays(30),
        ]);

        $response = $this->getJson("/api/v1/order-review/{$link->token}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.order_number', 'MO-001684')
            ->assertJsonPath('data.customer_notes', 'Customer-facing: Please check phone number font size.')
            ->assertJsonMissing(['admin_notes' => 'STRICTLY INTERNAL: VIP customer discount code applied internally.'])
            ->assertJsonMissing(['internal_notes' => 'STRICTLY INTERNAL: VIP customer discount code applied internally.']);

        // Verify open count incremented
        $link->refresh();
        $this->assertEquals(1, $link->open_count);
    }

    public function test_customer_can_request_changes(): void
    {
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
            'current_proof_version' => 1,
        ]);

        $link = OrderReviewLink::create([
            'order_id' => $order->id,
            'token' => 'change_request_token_12345678901234567890123456',
            'status' => 'active',
            'expires_at' => now()->addDays(30),
        ]);

        $payload = [
            'comment' => 'Please adjust our logo size on the back card by 15%.',
        ];

        $response = $this->postJson("/api/v1/order-review/{$link->token}/request-changes", $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'changes_requested');

        $order->refresh();
        $this->assertEquals(OrderStatus::CHANGES_REQUESTED, $order->status);

        $this->assertDatabaseHas('order_activities', [
            'order_id' => $order->id,
            'event_type' => 'change_requested',
        ]);
    }

    public function test_customer_approval_rejects_outdated_version_and_approves_current_version(): void
    {
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
            'current_proof_version' => 2, // Current version is V2!
        ]);

        $link = OrderReviewLink::create([
            'order_id' => $order->id,
            'token' => 'approval_test_token_1234567890123456789012345678',
            'status' => 'active',
            'expires_at' => now()->addDays(30),
        ]);

        // Attempting to approve outdated version (V1 when current is V2) must fail
        $outdatedResp = $this->postJson("/api/v1/order-review/{$link->token}/approve", [
            'spelling_confirmed' => true,
            'specs_confirmed' => true,
            'proof_version_confirmed' => true,
            'version_number' => 1,
        ]);
        $outdatedResp->assertStatus(422);

        // Approving exact current version (V2) must succeed
        $validResp = $this->postJson("/api/v1/order-review/{$link->token}/approve", [
            'spelling_confirmed' => true,
            'specs_confirmed' => true,
            'proof_version_confirmed' => true,
            'version_number' => 2,
        ]);

        $validResp->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.approved_version', 2)
            ->assertJsonPath('data.ready_for_payment', true);

        $order->refresh();
        $this->assertEquals(2, $order->approved_proof_version);
        $this->assertNotNull($order->proof_approved_at);
    }

    public function test_revoked_link_cannot_be_accessed(): void
    {
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'delivery_method' => 'Standard delivery (Free)',
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
            'current_proof_version' => 1,
        ]);

        $link = OrderReviewLink::create([
            'order_id' => $order->id,
            'token' => 'revoked_token_12345678901234567890123456789012',
            'status' => 'revoked',
            'revoked_at' => now(),
            'expires_at' => now()->addDays(30),
        ]);

        $response = $this->getJson("/api/v1/order-review/{$link->token}");
        $response->assertStatus(410);
    }

    public function test_order_cannot_move_to_production_without_proof_approval_and_paid_status(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Order unpaid and unapproved
        $order = Order::create([
            'order_number' => 'MO-001684',
            'user_id' => $this->customerUser->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::UNPAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'total_inc_gst' => 110.00,
            'shipping_address' => ['email' => $this->customerUser->email],
            'billing_address' => ['email' => $this->customerUser->email],
        ]);

        // Attempting to move unpaid order to production fails
        $response = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/move-to-production");
        $response->assertStatus(422);

        // Order marked paid, but proof still unapproved
        $order->update(['payment_status' => PaymentStatus::PAID]);
        $response2 = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/move-to-production");
        $response2->assertStatus(422);

        // Now with approved proof AND verified payment: succeeds
        $order->update(['approved_proof_version' => 1]);
        $response3 = $this->postJson("/api/v1/admin/manual-orders/{$order->id}/move-to-production");
        $response3->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'in_production');

        $order->refresh();
        $this->assertEquals(OrderStatus::IN_PRODUCTION, $order->status);
    }
}
