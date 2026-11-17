<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\ClientBrief;
use App\Models\ClientBriefFile;
use App\Models\Order;
use App\Models\OrderSpinEntitlement;
use App\Models\Product;
use App\Models\SpinReward;
use App\Models\SpinRewardCategory;
use App\Models\User;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SpinRewardDesignQueryFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_spun_reward_requires_payment_before_artwork_and_starts_production_after_approval(): void
    {
        $this->seed(SpinRewardSeeder::class);
        Mail::fake();
        Storage::fake('public');

        $customer = User::factory()->create([
            'name' => 'Design Reward Customer',
            'email' => 'reward-customer@example.com',
            'phone' => '0400000000',
            'company_name' => 'Reward Co',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => false,
            'permissions' => ['design_queries', 'pricing'],
        ]);

        $category = SpinRewardCategory::where('code', 'corporate')->firstOrFail();
        $reward = SpinReward::where('category_id', $category->id)
            ->where('reward_type', 'free_product')
            ->firstOrFail();
        $entitlement = OrderSpinEntitlement::create([
            'user_id' => $customer->id,
            'email' => $customer->email,
            'name' => $customer->name,
            'assigned_reward_id' => $reward->id,
            'spin_token' => Str::random(48),
            'status' => 'eligible',
        ]);

        // The reward is selected on the server when the customer spins.
        $spin = $this->postJson('/api/v1/spin-win/spin', [
            'spin_token' => $entitlement->spin_token,
        ])->assertOk()->assertJsonPath('data.prize.reward_type', 'free_product');
        $claimToken = $spin->json('data.prize.claim_token');

        // Sign-in links the won reward to the customer's account, then opens a submitted query.
        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/rewards/claim-spin-reward', ['claim_token' => $claimToken])
            ->assertOk();
        $started = $this->postJson('/api/v1/client-brief/start-from-reward', ['claim_token' => $claimToken])
            ->assertCreated()
            ->assertJsonPath('data.product', 'Business Cards');
        $token = $started->json('data.token');

        $this->getJson("/api/v1/client-brief/{$token}")
            ->assertOk()
            ->assertJsonPath('data.email', $customer->email)
            ->assertJsonPath('data.spin_reward.target_product', 'Business Cards');

        $brief = ClientBrief::where('token', $token)->firstOrFail();
        $productCategory = Category::create([
            'name' => 'Print Products',
            'slug' => 'print-products-' . Str::random(6),
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Business Cards',
            'slug' => 'business-cards-' . Str::random(6),
            'sku' => 'BC-' . Str::random(6),
            'base_price' => 100,
            'is_active' => true,
        ]);

        $paymentOrder = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/client-briefs/{$brief->id}/payment-order", [
                'product_name' => 'Business Cards',
                'quantity' => 250,
                'unit_price_ex_gst' => 100,
                'shipping_fee' => 0,
            ])->assertCreated()
            ->assertJsonPath('data.payment_status', 'unpaid');
        $order = Order::findOrFail($paymentOrder->json('data.order_id'));
        $this->assertSame('pending_payment', $order->status->value);
        $this->assertSame($customer->id, $order->user_id);

        // Artwork stays locked until the payment gateway confirms payment.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/client-briefs/{$brief->id}/design", [
                'file' => UploadedFile::fake()->create('final-proof.pdf', 20, 'application/pdf'),
                'message' => 'Your design is ready to approve.',
            ])->assertStatus(409);

        // Simulate the verified gateway callback; only then can the admin send artwork.
        $order->update(['payment_status' => 'paid']);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/client-briefs/{$brief->id}/design", [
                'file' => UploadedFile::fake()->create('final-proof.pdf', 20, 'application/pdf'),
                'message' => 'Your design is ready to approve.',
            ])->assertOk();

        $approved = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/client-brief/{$token}/approve")
            ->assertOk()
            ->assertJsonPath('success', true);
        $order = Order::findOrFail($approved->json('data.order_id'));
        $this->assertSame($customer->id, $order->user_id);
        $this->assertSame($brief->id, $order->client_brief_id);
        $this->assertSame('in_production', $order->status->value);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'applied_reward_code' => $spin->json('data.prize.reward_code'),
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_name' => 'Business Cards',
            'quantity' => 250,
            'production_status' => 'printing',
        ]);
        $this->assertSame('active', $brief->rewardLedger()->firstOrFail()->status);
    }

    public function test_quantity_based_label_and_a3_rewards_spin_create_fixed_quantity_queries_and_discount_orders(): void
    {
        $this->seed(SpinRewardSeeder::class);
        Mail::fake();

        $admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => false,
            'permissions' => ['design_queries', 'pricing'],
        ]);

        $cases = [
            [
                'reward_code' => '500_free_4x4_labels_on_2000',
                'product_name' => 'Gloss Product Packaging Roll Labels',
                'quantity' => 2000,
                'unit_price' => 1.00,
                'discount_percent' => 25.0,
                'expected_discount' => 550.0,
                'expected_total' => 1650.0,
            ],
            [
                'reward_code' => 'a3_poster_free',
                'product_name' => 'A3 Vibrant Artpaper Posters (297 x 420mm)',
                'quantity' => 500,
                'unit_price' => 1.00,
                'discount_percent' => 20.0,
                'expected_discount' => 110.0,
                'expected_total' => 440.0,
            ],
        ];

        foreach ($cases as $index => $case) {
            $customer = User::factory()->create([
                'email' => 'quantity-reward-' . $index . '@example.com',
                'company_name' => 'Reward Test Co',
            ]);
            $reward = SpinReward::where('code', $case['reward_code'])->firstOrFail();
            $this->assertSame('product_discount', $reward->reward_type);
            $this->assertSame($case['discount_percent'], (float) $reward->value);

            $entitlement = OrderSpinEntitlement::create([
                'user_id' => $customer->id,
                'email' => $customer->email,
                'name' => $customer->name,
                'assigned_reward_id' => $reward->id,
                'spin_token' => Str::random(48),
                'status' => 'eligible',
            ]);

            $spin = $this->postJson('/api/v1/spin-win/spin', [
                'spin_token' => $entitlement->spin_token,
            ])->assertOk()
                ->assertJsonPath('data.prize.title', $reward->title)
                ->assertJsonPath('data.prize.reward_type', 'product_discount');
            $this->assertEquals($case['discount_percent'], (float) $spin->json('data.prize.value'));

            $claimToken = $spin->json('data.prize.claim_token');
            $this->actingAs($customer, 'sanctum')
                ->postJson('/api/v1/rewards/claim-spin-reward', ['claim_token' => $claimToken])
                ->assertOk();
            $started = $this->postJson('/api/v1/client-brief/start-from-reward', ['claim_token' => $claimToken])
                ->assertCreated()
                ->assertJsonPath('data.product', $case['product_name'])
                ->assertJsonPath('data.quantity', $case['quantity']);

            $brief = ClientBrief::where('token', $started->json('data.token'))->firstOrFail();
            if ($index === 0) {
                $this->assertStringContainsString('4×4', $brief->description);
            }
            $category = Category::create([
                'name' => 'Spin Reward Products ' . $index,
                'slug' => 'spin-reward-products-' . $index . '-' . Str::random(5),
                'is_active' => true,
            ]);
            Product::create([
                'category_id' => $category->id,
                'name' => $case['product_name'],
                'slug' => 'spin-reward-product-' . $index . '-' . Str::random(5),
                'sku' => 'SPIN-' . $index . '-' . Str::random(5),
                'base_price' => 1.00,
                'is_active' => true,
            ]);
            $orderResponse = $this->actingAs($admin, 'sanctum')
                ->postJson('/api/v1/admin/client-briefs/' . $brief->id . '/payment-order', [
                    'product_name' => $case['product_name'],
                    'quantity' => $case['quantity'],
                    'unit_price_ex_gst' => $case['unit_price'],
                    'shipping_fee' => 0,
                ])->assertCreated()
                ->assertJsonPath('data.payment_status', 'unpaid');
            $order = Order::findOrFail($orderResponse->json('data.order_id'));
            $this->assertSame('pending_payment', $order->status->value);

            $this->assertSame($case['expected_discount'], (float) $order->discount_amount);
            $this->assertSame($case['expected_total'], (float) $order->total_inc_gst);
        }
    }
}
