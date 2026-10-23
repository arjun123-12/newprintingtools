<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\CustomerRewardLedger;
use App\Models\Order;
use App\Models\OrderSpinEntitlement;
use App\Models\Payment;
use App\Models\SpinReward;
use App\Models\SpinRewardCategory;
use App\Models\User;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CategorySpinWinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SpinRewardSeeder::class);
    }

    protected function createPaidOrder(User $user, ?string $businessCategory = null, string $orderNumber = 'PO-CAT-TEST'): Order
    {
        $order = Order::create([
            'order_number' => $orderNumber,
            'user_id' => $user->id,
            'business_category' => $businessCategory,
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
            'transaction_id' => 'TXN-' . Str::random(10),
            'amount' => 165.00,
            'status' => 'succeeded',
        ]);

        return $order;
    }

    public function test_customer_with_category_receives_category_specific_wheel_segments(): void
    {
        $user = User::factory()->create(['business_category' => 'hospitality']);
        $order = $this->createPaidOrder($user);

        $response = $this->actingAs($user)->getJson("/api/v1/spin-win/eligibility?order_number={$order->order_number}");

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.eligible'));
        $this->assertEquals('hospitality', $response->json('data.category.code'));
        $this->assertEquals('Hospitality & Restaurants', $response->json('data.category.name'));

        $segments = collect($response->json('data.wheel_segments'));
        $this->assertNotEmpty($segments);
        // Every segment belongs to hospitality
        foreach ($segments as $seg) {
            $this->assertEquals('hospitality', $seg['category_code']);
        }
    }

    public function test_customer_without_category_falls_back_to_default_rewards(): void
    {
        $user = User::factory()->create(['business_category' => null]);
        $order = $this->createPaidOrder($user, null, 'PO-DEFAULT-FALLBACK');

        $response = $this->actingAs($user)->getJson("/api/v1/spin-win/eligibility?order_number={$order->order_number}");

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.eligible'));
        $this->assertEquals('default', $response->json('data.category.code'));

        $segments = collect($response->json('data.wheel_segments'));
        $this->assertNotEmpty($segments);
        foreach ($segments as $seg) {
            $this->assertEquals('default', $seg['category_code']);
        }
    }

    public function test_category_with_no_active_rewards_falls_back_to_default_category(): void
    {
        // Deactivate all hospitality rewards
        $hospCat = SpinRewardCategory::where('code', 'hospitality')->first();
        SpinReward::where('category_id', $hospCat->id)->update(['is_active' => false]);

        $user = User::factory()->create(['business_category' => 'hospitality']);
        $order = $this->createPaidOrder($user, null, 'PO-HOSP-FALLBACK');

        $response = $this->actingAs($user)->getJson("/api/v1/spin-win/eligibility?order_number={$order->order_number}");

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.eligible'));
        // Falls back to Default category
        $this->assertEquals('default', $response->json('data.category.code'));
        $this->assertTrue($response->json('data.category.is_default'));
    }

    public function test_spin_stores_category_snapshot_on_ledger_and_order(): void
    {
        $user = User::factory()->create(['business_category' => 'real_estate']);
        $order = $this->createPaidOrder($user, null, 'PO-REAL-ESTATE-SPIN');

        // 1. Check eligibility
        $eligibilityRes = $this->actingAs($user)->getJson("/api/v1/spin-win/eligibility?order_number={$order->order_number}");
        $spinToken = $eligibilityRes->json('data.spin_token');
        $this->assertNotEmpty($spinToken);

        // 2. Perform spin
        $spinRes = $this->actingAs($user)->postJson('/api/v1/spin-win/spin', [
            'order_number' => $order->order_number,
            'spin_token' => $spinToken,
        ]);

        $spinRes->assertStatus(200);
        $this->assertTrue($spinRes->json('success'));
        $this->assertEquals('real_estate', $spinRes->json('data.category.code'));
        $this->assertNotEmpty($spinRes->json('data.prize.reward_code'));

        // Verify ledger has category snapshot
        $this->assertDatabaseHas('customer_reward_ledgers', [
            'order_id' => $order->id,
            'category_name' => 'Real Estate & Property',
        ]);

        // Verify order has business category saved
        $this->assertEquals('real_estate', $order->fresh()->business_category);
    }

    public function test_spin_is_idempotent_and_prevents_multiple_rewards(): void
    {
        $user = User::factory()->create(['business_category' => 'corporate']);
        $order = $this->createPaidOrder($user, null, 'PO-IDEMPOTENT-SPIN');

        $eligibilityRes = $this->actingAs($user)->getJson("/api/v1/spin-win/eligibility?order_number={$order->order_number}");
        $spinToken = $eligibilityRes->json('data.spin_token');

        // First spin
        $firstSpin = $this->actingAs($user)->postJson('/api/v1/spin-win/spin', [
            'order_number' => $order->order_number,
            'spin_token' => $spinToken,
        ]);
        $firstPrizeCode = $firstSpin->json('data.prize.reward_code');

        // Duplicate spin attempt
        $secondSpin = $this->actingAs($user)->postJson('/api/v1/spin-win/spin', [
            'order_number' => $order->order_number,
            'spin_token' => $spinToken,
        ]);

        $secondSpin->assertStatus(200);
        $this->assertTrue($secondSpin->json('data.already_spun'));
        $this->assertEquals($firstPrizeCode, $secondSpin->json('data.prize.reward_code'));

        // Only 1 ledger record created
        $this->assertEquals(1, CustomerRewardLedger::where('order_id', $order->id)->count());
    }

    public function test_atomic_inventory_decrements_and_respects_limits(): void
    {
        $retailCat = SpinRewardCategory::where('code', 'retail')->first();
        // Deactivate all retail rewards except one limited inventory item
        SpinReward::where('category_id', $retailCat->id)->update(['is_active' => false]);

        $limitedReward = SpinReward::create([
            'category_id' => $retailCat->id,
            'code' => 'test_limited_item',
            'title' => 'Limited Edition Voucher',
            'reward_type' => 'print_credit',
            'value' => 25.00,
            'inventory' => 1, // Only 1 left!
            'inventory_consumed' => 0,
            'terms_text' => 'Limited',
            'how_to_use' => 'Apply code',
            'color_bg' => '#ff0000',
            'color_text' => '#ffffff',
            'probability_weight' => 100,
            'min_order_spend' => 0.00,
            'expiry_days' => 30,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $user1 = User::factory()->create(['business_category' => 'retail']);
        $order1 = $this->createPaidOrder($user1, null, 'PO-INV-1');

        $res1 = $this->actingAs($user1)->getJson("/api/v1/spin-win/eligibility?order_number={$order1->order_number}");
        $token1 = $res1->json('data.spin_token');

        $spin1 = $this->actingAs($user1)->postJson('/api/v1/spin-win/spin', [
            'order_number' => $order1->order_number,
            'spin_token' => $token1,
        ]);
        $spin1->assertStatus(200);
        $this->assertEquals($limitedReward->title, $spin1->json('data.prize.title'));

        // Inventory should now be 0
        $limitedReward->refresh();
        $this->assertEquals(0, $limitedReward->inventory);
        $this->assertEquals(1, $limitedReward->inventory_consumed);

        // Next user in retail should NOT get the depleted item; it should fall back to Default
        $user2 = User::factory()->create(['business_category' => 'retail']);
        $order2 = $this->createPaidOrder($user2, null, 'PO-INV-2');

        $res2 = $this->actingAs($user2)->getJson("/api/v1/spin-win/eligibility?order_number={$order2->order_number}");
        // Since retail has 0 stocked rewards, it falls back to default
        $this->assertEquals('default', $res2->json('data.category.code'));
    }

    public function test_customer_can_update_business_category(): void
    {
        $user = User::factory()->create(['business_category' => null]);
        \Laravel\Sanctum\Sanctum::actingAs($user, ['*']);

        $response = $this->putJson('/api/v1/customers/profile', [
            'name' => 'John Updated',
            'business_category' => 'hospitality',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('hospitality', $user->fresh()->business_category);
    }

    public function test_admin_can_manage_categories_and_safe_delete_migrates_rewards(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => true,
        ]);

        // 1. Create a category
        $createRes = $this->actingAs($admin)->postJson('/api/v1/admin/spin-win/categories', [
            'name' => 'Fitness & Gyms',
            'description' => 'Rewards for personal trainers and gym studios',
            'icon' => 'activity',
            'is_active' => true,
            'sort_order' => 10,
        ]);

        $createRes->assertStatus(201);
        $catId = $createRes->json('data.id');
        $this->assertDatabaseHas('spin_reward_categories', ['name' => 'Fitness & Gyms']);

        // 2. Add reward under this category
        $reward = SpinReward::create([
            'category_id' => $catId,
            'code' => 'gym_towel_print',
            'title' => 'Gym Promo Voucher',
            'reward_type' => 'print_credit',
            'value' => 20.00,
            'terms_text' => 'Gym promo',
            'how_to_use' => 'Apply code',
            'color_bg' => '#123456',
            'color_text' => '#ffffff',
            'probability_weight' => 10,
            'expiry_days' => 60,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        // 3. Delete category (safe delete must migrate its rewards to default)
        $defaultCat = SpinRewardCategory::where('is_default', true)->first();
        $delRes = $this->actingAs($admin)->deleteJson("/api/v1/admin/spin-win/categories/{$catId}");

        $delRes->assertStatus(200);
        $this->assertSoftDeleted('spin_reward_categories', ['id' => $catId]);

        // Reward was migrated to default category
        $this->assertEquals($defaultCat->id, $reward->fresh()->category_id);
    }

    public function test_admin_cannot_delete_default_category(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => true,
        ]);

        $defaultCat = SpinRewardCategory::where('is_default', true)->first();

        $response = $this->actingAs($admin)->deleteJson("/api/v1/admin/spin-win/categories/{$defaultCat->id}");

        $response->assertStatus(422);
        $this->assertStringContainsString('The Default category cannot be deleted', $response->json('message'));
        $this->assertDatabaseHas('spin_reward_categories', ['id' => $defaultCat->id, 'deleted_at' => null]);
    }
}
