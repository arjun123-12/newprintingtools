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

    public function test_spun_reward_flows_through_design_query_approval_into_order_pricing(): void
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

        // Sign-in links the won reward to the customer's account, then opens the prefilled query.
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

        $this->postJson("/api/v1/client-brief/{$token}/submit", [
            'request_type' => 'design',
            'contact' => $customer->name,
            'company' => $customer->company_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'product' => 'Business Cards',
            'quantity' => 250,
            'unit' => 'mm',
            'print_sides' => 'both',
            'fulfilment' => 'pickup',
            'specs' => 'Please create a fresh branded business card design.',
            'files' => [UploadedFile::fake()->image('reference.png')],
        ])->assertCreated();

        $brief = ClientBrief::where('token', $token)->firstOrFail();
        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/design-queries/{$brief->id}/fee", ['design_fee' => 50])
            ->assertOk();
        $this->assertDatabaseHas('client_brief_messages', [
            'client_brief_id' => $brief->id,
            'author' => 'employee',
        ]);

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

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/design-queries/{$brief->id}/design", [
                'file' => UploadedFile::fake()->create('final-proof.pdf', 20, 'application/pdf'),
                'message' => 'Your design is ready to approve.',
            ])->assertOk();

        // The customer cannot approve a proof until accepting the fee.
        $this->postJson("/api/v1/client-brief/{$token}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Please accept the design service fee before approving the design.');
        $this->postJson("/api/v1/client-brief/{$token}/accept-design-fee")
            ->assertOk();

        $approved = $this->postJson("/api/v1/client-brief/{$token}/approve")
            ->assertOk()
            ->assertJsonPath('success', true);
        $order = Order::findOrFail($approved->json('data.order_id'));
        $this->assertSame($customer->id, $order->user_id);
        $this->assertSame($brief->id, $order->client_brief_id);
        $this->assertSame('pending_payment', $order->status->value);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'applied_reward_code' => $spin->json('data.prize.reward_code'),
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_name' => 'Graphic design service',
            'unit_price_ex_gst' => 50,
        ]);

        // Admin sets the print quote; the free-product reward deducts one target-product unit.
        app(\App\Services\Order\ManualOrderService::class)->updateManualOrder($order, $admin, [
            'items' => [
                ['product_id' => $product->id, 'product_name' => 'Business Cards', 'quantity' => 1, 'price' => 100],
                ['product_name' => 'Graphic design service', 'quantity' => 1, 'price' => 50, 'options' => ['non_production' => true]],
            ],
            'delivery_method' => 'Pickup',
        ]);

        $order->refresh();
        $this->assertSame(110.0, (float) $order->discount_amount);
        $this->assertSame(55.0, (float) $order->total_inc_gst);
        $this->assertSame('active', $brief->rewardLedger()->firstOrFail()->status);
    }
}
