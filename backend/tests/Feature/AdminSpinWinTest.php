<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SpinRewardSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
