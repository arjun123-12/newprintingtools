<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Pricing\PricingCalculatorService;
use InvalidArgumentException;
use Tests\TestCase;

class PrintingConfigurationPricingTest extends TestCase
{
    protected User $adminUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Printing Config Tester',
            'email' => 'admin_printing_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Cards & Print Test',
            'slug' => 'cards-print-test-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Save product with printing configuration pricing.
     */
    public function test_save_product_with_printing_configuration_pricing(): void
    {
        $printingConfig = [
            'enabled' => true,
            'options' => [
                [
                    'id' => 'front_only',
                    'name' => 'Single-Sided (Front Only)',
                    'side_type' => 'front_only',
                    'is_active' => true,
                    'is_default' => true,
                    'tiers' => [
                        ['id' => 'pt_1', 'quantity' => 100, 'total_price' => 25.00, 'per_card_price' => 0.25, 'label' => 'Starter'],
                        ['id' => 'pt_2', 'quantity' => 250, 'total_price' => 40.00, 'per_card_price' => 0.16, 'label' => 'Standard'],
                        ['id' => 'pt_3', 'quantity' => 500, 'total_price' => 60.00, 'per_card_price' => 0.12, 'label' => 'Popular'],
                    ],
                ],
                [
                    'id' => 'front_back',
                    'name' => 'Double-Sided (Front & Back)',
                    'side_type' => 'front_back',
                    'is_active' => true,
                    'is_default' => false,
                    'tiers' => [
                        ['id' => 'pt_4', 'quantity' => 100, 'total_price' => 35.00, 'per_card_price' => 0.35, 'label' => 'Starter'],
                        ['id' => 'pt_5', 'quantity' => 250, 'total_price' => 55.00, 'per_card_price' => 0.22, 'label' => 'Standard'],
                        ['id' => 'pt_6', 'quantity' => 500, 'total_price' => 85.00, 'per_card_price' => 0.17, 'label' => 'Popular'],
                    ],
                ],
            ],
        ];

        $payload = [
            'name' => 'Premium Silk Business Cards ' . uniqid(),
            'slug' => 'premium-silk-business-cards-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 49.99,
            'min_quantity' => 100,
            'turnaround_days' => 3,
            'is_active' => true,
            'printing_pricing' => $printingConfig,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201);
        $productId = $response->json('data.id');

        $product = Product::findOrFail($productId);
        $this->assertNotNull($product->printing_pricing);
        $this->assertTrue($product->printing_pricing['enabled']);
        $this->assertCount(2, $product->printing_pricing['options']);
        $this->assertEquals('Single-Sided (Front Only)', $product->printing_pricing['options'][0]['name']);
        $this->assertEquals(25.00, $product->printing_pricing['options'][0]['tiers'][0]['total_price']);
    }

    /**
     * Test 2: Loading an existing product returns printing_pricing.
     */
    public function test_load_product_returns_printing_pricing(): void
    {
        $product = Product::create([
            'name' => 'Test Load Printing Product ' . uniqid(),
            'slug' => 'test-load-printing-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 29.99,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Single-Sided (Front Only)',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 25.00, 'per_card_price' => 0.25],
                            ['quantity' => 250, 'total_price' => 40.00, 'per_card_price' => 0.16],
                        ],
                    ],
                ],
            ],
        ]);

        $response = $this->actingAs($this->adminUser)
            ->getJson("/api/v1/admin/products/{$product->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.printing_pricing.enabled', true);
        $response->assertJsonPath('data.printing_pricing.options.0.id', 'front_only');
        $response->assertJsonPath('data.printing_pricing.options.0.tiers.1.quantity', 250);
        $response->assertJsonPath('data.printing_pricing.options.0.tiers.1.total_price', 40);
    }

    /**
     * Test 3: Fixed-total pricing and per-card calculations for single-sided.
     */
    public function test_pricing_calculator_fixed_total_single_sided(): void
    {
        $product = Product::create([
            'name' => 'Test Single Sided Calc ' . uniqid(),
            'slug' => 'test-single-sided-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Front Only',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 25.00],
                            ['quantity' => 250, 'total_price' => 40.00],
                            ['quantity' => 500, 'total_price' => 60.00],
                        ],
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();

        // 250 cards: Fixed total $40.00, per-card $0.16
        $res250 = $calculator->calculate($product, 250, ['printing_side_id' => 'front_only']);

        $this->assertEquals(40.00, $res250['base_printing_subtotal_ex_gst']);
        $this->assertEquals(40.00, $res250['subtotal_ex_gst']);
        $this->assertEquals(0.16, $res250['base_unit_price_ex_gst']);
        $this->assertEquals(4.00, $res250['gst_amount']);
        $this->assertEquals(44.00, $res250['total_inc_gst']);
        $this->assertNotNull($res250['printing_config_details']);
        $this->assertEquals(40.00, $res250['printing_config_details']['fixed_total_price']);
        $this->assertEquals(0.16, $res250['printing_config_details']['per_card_price']);
    }

    /**
     * Test 4: Switching between Front Only and Front & Back configurations.
     */
    public function test_pricing_calculator_switch_front_and_back(): void
    {
        $product = Product::create([
            'name' => 'Test Switch Sides ' . uniqid(),
            'slug' => 'test-switch-sides-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Front Only',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 25.00],
                            ['quantity' => 250, 'total_price' => 40.00],
                        ],
                    ],
                    [
                        'id' => 'front_back',
                        'name' => 'Front and Back',
                        'side_type' => 'front_back',
                        'is_active' => true,
                        'is_default' => false,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 35.00],
                            ['quantity' => 250, 'total_price' => 55.00],
                        ],
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();

        // 250 Front only -> $40.00
        $resFront = $calculator->calculate($product, 250, ['printing_side_id' => 'front_only']);
        $this->assertEquals(40.00, $resFront['base_printing_subtotal_ex_gst']);
        $this->assertEquals(0.16, $resFront['base_unit_price_ex_gst']);

        // 250 Double sided -> $55.00 (per card $0.22)
        $resDouble = $calculator->calculate($product, 250, ['printing_side_id' => 'front_back']);
        $this->assertEquals(55.00, $resDouble['base_printing_subtotal_ex_gst']);
        $this->assertEquals(0.22, $resDouble['base_unit_price_ex_gst']);
        $this->assertEquals(5.50, $resDouble['gst_amount']);
        $this->assertEquals(60.50, $resDouble['total_inc_gst']);
    }

    /**
     * Test 5: Default configuration is used when no side selection is explicitly passed.
     */
    public function test_pricing_calculator_uses_default_when_unspecified(): void
    {
        $product = Product::create([
            'name' => 'Test Default Config ' . uniqid(),
            'slug' => 'test-default-config-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Front Only',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 25.00],
                        ],
                    ],
                    [
                        'id' => 'front_back',
                        'name' => 'Front and Back',
                        'side_type' => 'front_back',
                        'is_active' => true,
                        'is_default' => false,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 35.00],
                        ],
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();
        $res = $calculator->calculate($product, 100, []);

        $this->assertEquals(25.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertEquals('front_only', $res['printing_config_details']['option_id']);
    }

    /**
     * Test 6: Unconfigured quantity throws clear validation exception.
     */
    public function test_unconfigured_quantity_rejected(): void
    {
        $product = Product::create([
            'name' => 'Test Unconfigured Quantity ' . uniqid(),
            'slug' => 'test-unconfig-qty-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Front Only',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 25.00],
                            ['quantity' => 250, 'total_price' => 40.00],
                        ],
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No configured fixed-total pricing tier found for quantity 300');

        $calculator->calculate($product, 300, ['printing_side_id' => 'front_only']);
    }

    /**
     * Test 7: Inactive printing configuration is rejected.
     */
    public function test_inactive_printing_configuration_rejected(): void
    {
        $product = Product::create([
            'name' => 'Test Inactive Config ' . uniqid(),
            'slug' => 'test-inactive-config-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'custom_sided',
                        'name' => 'Custom Sided',
                        'side_type' => 'custom',
                        'is_active' => false,
                        'is_default' => false,
                        'tiers' => [
                            ['quantity' => 100, 'total_price' => 50.00],
                        ],
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Selected printing configuration 'Custom Sided' is currently inactive.");

        $calculator->calculate($product, 100, ['printing_side_id' => 'custom_sided']);
    }

    /**
     * Test 8: Fixed-total printing combined with folding add-on pricing.
     */
    public function test_printing_config_with_folding_addon_combined(): void
    {
        $product = Product::create([
            'name' => 'Test Printing Folding Combo ' . uniqid(),
            'slug' => 'test-print-fold-combo-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 50.00,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_back',
                        'name' => 'Front & Back',
                        'side_type' => 'front_back',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [
                            ['quantity' => 250, 'total_price' => 55.00],
                        ],
                    ],
                ],
            ],
            'folding_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'half_fold',
                        'name' => 'Half Fold',
                        'type' => 'half_fold',
                        'is_active' => true,
                        'pricing_method' => 'per_order',
                        'charge' => 12.00,
                    ],
                ],
            ],
        ]);

        $calculator = new PricingCalculatorService();

        $res = $calculator->calculate($product, 250, [
            'printing_side_id' => 'front_back',
            'folding_style' => 'half_fold',
        ]);

        // Base printing: $55.00 fixed total
        $this->assertEquals(55.00, $res['base_printing_subtotal_ex_gst']);
        // Folding charge: $12.00 per-order
        $this->assertEquals(12.00, $res['folding_charge_ex_gst']);
        // Subtotal ex GST: $55 + $12 = $67.00
        $this->assertEquals(67.00, $res['subtotal_ex_gst']);
        // GST: 10% of $67 = $6.70
        $this->assertEquals(6.70, $res['gst_amount']);
        // Total inc GST: $73.70
        $this->assertEquals(73.70, $res['total_inc_gst']);
    }

    /**
     * Test 9: Existing product without printing_pricing continues to use standard pricing.
     */
    public function test_product_without_printing_pricing_uses_base_price(): void
    {
        $product = Product::create([
            'name' => 'Test No Printing Config ' . uniqid(),
            'slug' => 'test-no-printing-config-' . uniqid(),
            'category_id' => $this->category->id,
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 0.50,
            'printing_pricing' => null,
        ]);

        $calculator = new PricingCalculatorService();
        $res = $calculator->calculate($product, 100, []);

        $this->assertEquals(50.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertNull($res['printing_config_details']);
    }
}
