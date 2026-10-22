<?php

namespace Database\Seeders;

use App\Models\SpinReward;
use App\Models\SpinWinSetting;
use Illuminate\Database\Seeder;

class SpinRewardSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Initialize Global Spin & Win Settings
        SpinWinSetting::set('enabled', true);
        SpinWinSetting::set('min_order_spend', 0.00);
        SpinWinSetting::set('banner_title', 'SPIN & WIN');
        SpinWinSetting::set('banner_subtitle', 'AMAZING PRINTING REWARDS AWAIT!');
        SpinWinSetting::set('banner_tagline', 'Play the wheel and unlock exciting rewards for your business.');

        // 2. Default Configured Reward Segments (based on the ERRY IMPRINTS branded wheel)
        $rewards = [
            [
                'code' => '100_business_cards_free',
                'title' => '100 Business Cards',
                'reward_type' => 'free_product',
                'badge_text' => 'FREE',
                'value' => 45.00,
                'description' => '100 Premium 350gsm Silk Business Cards with full color double-sided print.',
                'terms_text' => 'Valid on standard 350gsm Premium Silk Business Cards (Qty: 100). One voucher per order.',
                'how_to_use' => 'Added to your account as a reward. Redeem at checkout on your next eligible order.',
                'color_bg' => '#e0f2fe',
                'color_text' => '#0369a1',
                'icon' => 'card',
                'probability_weight' => 15,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'code' => 'print_dollars_25',
                'title' => '$25 Print Dollars',
                'reward_type' => 'print_credit',
                'badge_text' => '$25',
                'value' => 25.00,
                'description' => '$25 print credit voucher for future commercial or marketing print orders.',
                'terms_text' => '$25 store credit applied towards any future print order with subtotal over $50.',
                'how_to_use' => 'Added to your Print Bank™. Apply your unique reward code at checkout.',
                'color_bg' => '#fef08a',
                'color_text' => '#854d0e',
                'icon' => 'coins',
                'probability_weight' => 20,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'code' => 'a3_poster_free',
                'title' => 'A3 Poster',
                'reward_type' => 'free_product',
                'badge_text' => 'FREE',
                'value' => 30.00,
                'description' => '1x Custom A3 Poster on premium 200gsm photo/satin paper.',
                'terms_text' => 'Valid on 1x A3 Gloss/Matte Artpaper Poster on any future print run.',
                'how_to_use' => 'Choose an A3 poster from products. Apply reward code at checkout.',
                'color_bg' => '#dbeafe',
                'color_text' => '#1d4ed8',
                'icon' => 'image',
                'probability_weight' => 10,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'code' => 'flyer_credit_20',
                'title' => 'Flyer Credit',
                'reward_type' => 'print_credit',
                'badge_text' => '$20',
                'value' => 20.00,
                'description' => '$20 credit on any folded brochure, flyer, or menu printing project.',
                'terms_text' => '$20 credit applicable on any flyer or folded brochure printing order.',
                'how_to_use' => 'Added to your Print Bank™. Use on any flyer order at checkout.',
                'color_bg' => '#fce7f3',
                'color_text' => '#be185d',
                'icon' => 'layers',
                'probability_weight' => 25,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 4,
            ],
            [
                'code' => 'premium_upgrade_free',
                'title' => 'Premium Upgrade',
                'reward_type' => 'premium_upgrade',
                'badge_text' => 'FREE',
                'value' => 35.00,
                'description' => 'Complimentary finish upgrade to Matte, Gloss, or Soft-Touch Velvet lamination.',
                'terms_text' => 'Free upgrade to Matte, Gloss, or Soft-Touch Velvet Lamination on future print orders.',
                'how_to_use' => 'Apply at checkout. Valid for premium paper or lamination upgrade.',
                'color_bg' => '#f3e8ff',
                'color_text' => '#7e22ce',
                'icon' => 'sparkles',
                'probability_weight' => 15,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 5,
            ],
            [
                'code' => 'shipping_upgrade_free',
                'title' => 'Free Shipping Upgrade',
                'reward_type' => 'shipping_upgrade',
                'badge_text' => 'FREE',
                'value' => 18.00,
                'description' => 'Free standard CouriersPlease domestic parcel dispatch across Australia.',
                'terms_text' => 'Free domestic delivery on your next print consignment across Australia.',
                'how_to_use' => 'Redeem voucher code at checkout to waive standard delivery fee.',
                'color_bg' => '#dcfce7',
                'color_text' => '#15803d',
                'icon' => 'truck',
                'probability_weight' => 20,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 6,
            ],
            [
                'code' => 'print_dollars_10',
                'title' => '$10 Print Dollars',
                'reward_type' => 'print_credit',
                'badge_text' => '$10',
                'value' => 10.00,
                'description' => '$10 instant Print Dollars added directly to your reward balance.',
                'terms_text' => 'Added to your Print Bank™. Use anytime for any product with no minimum spend.',
                'how_to_use' => 'Added to your Print Bank. Use anytime for any product.',
                'color_bg' => '#fef9c3',
                'color_text' => '#a16207',
                'icon' => 'coins',
                'probability_weight' => 30,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 7,
            ],
            [
                'code' => 'a5_flyers_free',
                'title' => 'A5 Flyers (100 pcs)',
                'reward_type' => 'free_product',
                'badge_text' => 'FREE',
                'value' => 55.00,
                'description' => '100 complimentary double-sided A5 flyers on 150gsm Gloss Artpaper.',
                'terms_text' => '100 free A5 flyers (150gsm Gloss) on your next promotional campaign order.',
                'how_to_use' => 'Added to your account as a reward. Redeem at checkout. Pay only for shipping or finish upgrade.',
                'color_bg' => '#fae8ff',
                'color_text' => '#a21caf',
                'icon' => 'package',
                'probability_weight' => 10,
                'min_order_spend' => 0.00,
                'expiry_days' => 90,
                'is_active' => true,
                'sort_order' => 8,
            ],
        ];

        foreach ($rewards as $reward) {
            SpinReward::updateOrCreate(['code' => $reward['code']], $reward);
        }
    }
}
