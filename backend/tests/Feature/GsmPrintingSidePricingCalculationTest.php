<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\User;
use App\Services\Cart\CartService;
use App\Services\Checkout\CheckoutService;
use App\Services\Pricing\PricingCalculatorService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use InvalidArgumentException;
use Tests\TestCase;

class GsmPrintingSidePricingCalculationTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Pricing Tester',
            'email' => 'admin_pricing_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Tester',
            'email' => 'customer_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Business Cards & Stationery',
            'slug' => 'business-cards-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * Helper to create a product configured with GSM options and independent side tiers.
     */
    protected function createGsmProduct(array $overrides = []): Product
    {
        $defaultConfig = [
            'enabled' => true,
            'options' => [
                [
                    'id' => 'front_only',
                    'name' => 'Single-Sided (Front Only)',
                    'side_type' => 'front_only',
                    'is_active' => true,
                    'is_default' => true,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 20.00, 'label' => '100 Cards'],
                        ['quantity' => 250, 'total_price' => 32.00, 'label' => '250 Cards'],
                    ],
                ],
                [
                    'id' => 'front_back',
                    'name' => 'Double-Sided (Front & Back)',
                    'side_type' => 'front_back',
                    'is_active' => true,
                    'is_default' => false,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 30.00, 'label' => '100 Cards'],
                        ['quantity' => 250, 'total_price' => 48.00, 'label' => '250 Cards'],
                    ],
                ],
            ],
            'gsm_options' => [
                [
                    'id' => 'gsm_128',
                    'gsm' => 128,
                    'name' => '128 GSM',
                    'stock_name' => 'Standard Art Paper',
                    'is_active' => true,
                    'is_default' => true,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 20.00],
                        ['quantity' => 250, 'total_price' => 32.00],
                    ],
                    'side_tiers' => [
                        'front_only' => [
                            ['quantity' => 100, 'total_price' => 20.00, 'per_card_price' => 0.20],
                            ['quantity' => 250, 'total_price' => 32.00, 'per_card_price' => 0.128],
                        ],
                        'front_back' => [
                            ['quantity' => 100, 'total_price' => 28.00, 'per_card_price' => 0.28],
                            ['quantity' => 250, 'total_price' => 44.80, 'per_card_price' => 0.1792],
                        ],
                    ],
                ],
                [
                    'id' => 'gsm_150',
                    'gsm' => 150,
                    'name' => '150 GSM',
                    'stock_name' => 'Gloss Art Paper',
                    'is_active' => true,
                    'is_default' => false,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 22.50],
                        ['quantity' => 250, 'total_price' => 36.00],
                    ],
                    'side_tiers' => [
                        'front_only' => [
                            ['quantity' => 100, 'total_price' => 22.50, 'per_card_price' => 0.225],
                            ['quantity' => 250, 'total_price' => 36.00, 'per_card_price' => 0.144],
                        ],
                        'front_back' => [
                            ['quantity' => 100, 'total_price' => 31.50, 'per_card_price' => 0.315],
                            ['quantity' => 250, 'total_price' => 50.40, 'per_card_price' => 0.2016],
                        ],
                    ],
                ],
            ],
        ];

        $foldingConfig = [
            'enabled' => true,
            'pricing_method' => 'per_order',
            'charge' => 10.00,
            'options' => [
                ['id' => 'no_fold', 'name' => 'No Folding', 'type' => 'no_fold', 'is_active' => true, 'charge' => 0],
                ['id' => 'half_fold', 'name' => 'Half Fold', 'type' => 'half_fold', 'pricing_method' => 'per_order', 'charge' => 10.00, 'is_active' => true],
                ['id' => 'tri_fold', 'name' => 'Tri-Fold', 'type' => 'tri_fold', 'pricing_method' => 'per_copy', 'charge' => 0.05, 'is_active' => true],
            ],
        ];

        $payload = array_merge([
            'category_id' => $this->category->id,
            'name' => 'Configured Print Product ' . uniqid(),
            'slug' => 'configured-print-product-' . uniqid(),
            'sku' => 'PRINT-' . strtoupper(uniqid()),
            'base_price' => 45.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 3,
            'is_active' => true,
            'printing_pricing' => $defaultConfig,
            'folding_pricing' => $foldingConfig,
        ], $overrides);

        return Product::create($payload);
    }

    /**
     * Scenario 1 (Test A): 128 GSM + single-sided + 100 cards
     * Expected printing price: the saved 128 GSM, single-sided, 100-quantity fixed total ($20.00).
     */
    public function test_scenario_a_128_gsm_single_sided_100_qty(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
        ]);

        $this->assertEquals(20.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(20.00, $result['subtotal_ex_gst']);
        $this->assertEquals(0.20, $result['printing_config_details']['per_card_price']);
        $this->assertEquals('128 GSM', $result['printing_config_details']['gsm_name']);
        $this->assertEquals('front_only', $result['printing_config_details']['side_type']);
        $this->assertEquals(2.00, $result['gst_amount']);
        $this->assertEquals(22.00, $result['total_inc_gst']);
    }

    /**
     * Scenario 2 (Test B): 150 GSM + single-sided + 100 cards
     * Expected printing price: the saved 150 GSM, single-sided, 100-quantity fixed total ($22.50).
     */
    public function test_scenario_b_150_gsm_single_sided_100_qty(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_150',
            'printing_side_id' => 'front_only',
        ]);

        $this->assertEquals(22.50, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(22.50, $result['subtotal_ex_gst']);
        $this->assertEquals(0.225, $result['printing_config_details']['per_card_price']);
        $this->assertEquals('150 GSM', $result['printing_config_details']['gsm_name']);
        $this->assertEquals(2.25, $result['gst_amount']);
        $this->assertEquals(24.75, $result['total_inc_gst']);
    }

    /**
     * Scenario 3 (Test C): 128 GSM + double-sided + 100 cards
     * Expected printing price: the saved 128 GSM, double-sided, 100-quantity fixed total ($28.00).
     */
    public function test_scenario_c_128_gsm_double_sided_100_qty(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_back',
        ]);

        $this->assertEquals(28.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(28.00, $result['subtotal_ex_gst']);
        $this->assertEquals(0.28, $result['printing_config_details']['per_card_price']);
        $this->assertEquals('128 GSM', $result['printing_config_details']['gsm_name']);
        $this->assertEquals('front_back', $result['printing_config_details']['side_type']);
        $this->assertEquals(2.80, $result['gst_amount']);
        $this->assertEquals(30.80, $result['total_inc_gst']);
    }

    /**
     * Scenario 4: Valid combination with folding selected (per-order: $10.00).
     * Total = Printing ($28.00) + Folding ($10.00) = $38.00 ex GST.
     */
    public function test_scenario_4_combination_with_folding_selected(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_back',
            'folding_style' => 'half_fold',
        ]);

        $this->assertEquals(28.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(10.00, $result['folding_charge_ex_gst']);
        $this->assertEquals(38.00, $result['subtotal_ex_gst']);
        $this->assertEquals(3.80, $result['gst_amount']);
        $this->assertEquals(41.80, $result['total_inc_gst']);
    }

    /**
     * Scenario 5: Combination without folding (no_fold) has zero folding charge.
     */
    public function test_scenario_5_combination_without_folding_has_zero_charge(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_back',
            'folding_style' => 'no_fold',
        ]);

        $this->assertEquals(28.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(0.00, $result['folding_charge_ex_gst']);
        $this->assertEquals(28.00, $result['subtotal_ex_gst']);
        $this->assertEquals(30.80, $result['total_inc_gst']);
    }

    /**
     * Scenario 6: Changing GSM switches to the correct saved price.
     */
    public function test_scenario_6_change_gsm_selects_correct_price(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        // 128 GSM, double-sided, 250 qty -> $44.80
        $res128 = $calculator->calculate($product, 250, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_back',
        ]);
        $this->assertEquals(44.80, $res128['base_printing_subtotal_ex_gst']);

        // Switch to 150 GSM, double-sided, 250 qty -> $50.40
        $res150 = $calculator->calculate($product, 250, [
            'gsm_id' => 'gsm_150',
            'printing_side_id' => 'front_back',
        ]);
        $this->assertEquals(50.40, $res150['base_printing_subtotal_ex_gst']);
    }

    /**
     * Scenario 7: Changing printing side switches to the correct saved price.
     */
    public function test_scenario_7_change_printing_side_selects_correct_price(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        // 150 GSM, single-sided, 250 qty -> $36.00
        $resSingle = $calculator->calculate($product, 250, [
            'gsm_id' => 'gsm_150',
            'printing_side_id' => 'front_only',
        ]);
        $this->assertEquals(36.00, $resSingle['base_printing_subtotal_ex_gst']);

        // Switch to double-sided, 250 qty -> $50.40
        $resDouble = $calculator->calculate($product, 250, [
            'gsm_id' => 'gsm_150',
            'printing_side_id' => 'front_back',
        ]);
        $this->assertEquals(50.40, $resDouble['base_printing_subtotal_ex_gst']);
    }

    /**
     * Scenario 8: Save product via admin API, reload it, verify pricing configuration persists identically.
     */
    public function test_scenario_8_save_and_reload_product_preserves_pricing(): void
    {
        $productPayload = [
            'category_id' => $this->category->id,
            'name' => 'Deluxe Print Cards ' . uniqid(),
            'slug' => 'deluxe-print-cards-' . uniqid(),
            'sku' => 'DELUXE-' . strtoupper(uniqid()),
            'base_price' => 50.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'printing_pricing' => [
                'enabled' => true,
                'options' => [
                    [
                        'id' => 'front_only',
                        'name' => 'Single-Sided',
                        'side_type' => 'front_only',
                        'is_active' => true,
                        'tiers' => [['quantity' => 100, 'total_price' => 25.00]],
                    ],
                ],
                'gsm_options' => [
                    [
                        'id' => 'gsm_128',
                        'gsm' => 128,
                        'name' => '128 GSM',
                        'stock_name' => 'Silk Paper',
                        'is_active' => true,
                        'is_default' => true,
                        'tiers' => [['quantity' => 100, 'total_price' => 25.00]],
                        'side_tiers' => [
                            'front_only' => [['quantity' => 100, 'total_price' => 25.00, 'per_card_price' => 0.25]],
                        ],
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/products', $productPayload);

        $response->assertStatus(201);
        $productId = $response->json('data.id');

        $reloaded = Product::findOrFail($productId);
        $this->assertTrue($reloaded->printing_pricing['enabled']);
        $this->assertEquals('128 GSM', $reloaded->printing_pricing['gsm_options'][0]['name']);
        $this->assertEquals(25.00, $reloaded->printing_pricing['gsm_options'][0]['side_tiers']['front_only'][0]['total_price']);
    }

    /**
     * Scenario 9: Add product to cart and verify all selections and price breakdown are retained.
     */
    public function test_scenario_9_add_product_to_cart_retains_selections_and_price(): void
    {
        $product = $this->createGsmProduct();
        $cartService = app(CartService::class);
        $cart = $cartService->getOrCreateCart(null, $this->customerUser->id);

        $selectedOptions = [
            'gsm_id' => 'gsm_128',
            'gsm_name' => '128 GSM',
            'paper_stock' => 'Standard Art Paper',
            'printing_side_id' => 'front_back',
            'printing_side_name' => 'Double-Sided (Front & Back)',
            'folding_style' => 'half_fold',
            'folding_name' => 'Half Fold',
        ];

        $item = $cartService->addItem($cart, [
            'product_id' => $product->id,
            'quantity' => 100,
            'selected_options' => $selectedOptions,
        ]);

        $this->assertEquals($product->id, $item->product_id);
        $this->assertEquals(100, $item->quantity);
        $this->assertEquals('gsm_128', $item->selected_options['gsm_id']);
        $this->assertEquals('front_back', $item->selected_options['printing_side_id']);
        $this->assertEquals('half_fold', $item->selected_options['folding_style']);

        // Printing ($28.00) + Folding ($10.00) = $38.00
        $this->assertEquals(38.00, (float) $item->subtotal_ex_gst);
        $this->assertEquals(3.80, (float) $item->gst_amount);
        $this->assertEquals(41.80, (float) $item->total_inc_gst);
    }

    /**
     * Scenario 10: Checkout recalculates backend total without trusting client prices.
     */
    public function test_scenario_10_checkout_recalculates_authoritative_total(): void
    {
        $user = User::create([
            'name' => 'Checkout Tester ' . uniqid(),
            'email' => 'checkout_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);

        $product = $this->createGsmProduct();
        $cartService = app(CartService::class);
        $cart = $cartService->getOrCreateCart(null, $user->id);

        // Add item
        $item = $cartService->addItem($cart, [
            'product_id' => $product->id,
            'quantity' => 100,
            'selected_options' => [
                'gsm_id' => 'gsm_150',
                'printing_side_id' => 'front_only',
                'folding_style' => 'no_fold',
            ],
        ]);

        $this->assertNotNull($item);
        $this->assertEquals(1, $cart->fresh()->items()->count());

        $checkoutService = app(CheckoutService::class);
        $checkoutData = $checkoutService->getCheckoutData($user);

        // Subtotal for 150 GSM front_only 100 qty is $22.50
        $this->assertEquals(22.50, $checkoutData['subtotal_ex_gst']);
        $this->assertEquals(2.25, $checkoutData['gst_amount']);
        $this->assertCount(1, $checkoutData['items']);
        $this->assertEquals(22.50, $checkoutData['items'][0]['subtotal_ex_gst']);
    }

    /**
     * Scenario 11: Unavailable GSM / side / quantity tier blocks calculation.
     */
    public function test_scenario_11_unavailable_tier_blocks_calculation(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No configured fixed-total pricing tier found for quantity 375');

        // Quantity 375 does not exist in configured tiers
        $calculator->calculate($product, 375, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
        ]);
    }

    /**
     * Scenario 12: Taxes, discounts and free shipping applied correctly.
     */
    public function test_scenario_12_taxes_and_shipping_rules(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $result = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
        ]);

        // Subtotal: $20.00
        $this->assertEquals(20.00, $result['subtotal_ex_gst']);
        // 10% Australian GST: $2.00
        $this->assertEquals(2.00, $result['gst_amount']);
        // Total inc GST: $22.00
        $this->assertEquals(22.00, $result['total_inc_gst']);
        // No double-counting
        $this->assertEquals(0.00, $result['folding_charge_ex_gst']);
    }

    /**
     * Test explicit invalid GSM selection is rejected with InvalidArgumentException.
     */
    public function test_invalid_gsm_selection_rejected(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Selected GSM or paper stock 'gsm_invalid_999' is invalid or unavailable for this product.");

        $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_invalid_999',
            'printing_side_id' => 'front_only',
        ]);
    }

    /**
     * Test explicit inactive GSM option is rejected with InvalidArgumentException.
     */
    public function test_inactive_gsm_selection_rejected(): void
    {
        $config = [
            'enabled' => true,
            'gsm_options' => [
                [
                    'id' => 'gsm_350',
                    'gsm' => 350,
                    'name' => '350 GSM Heavy Card',
                    'is_active' => false,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 50.00],
                    ],
                ],
            ],
            'options' => [
                [
                    'id' => 'front_only',
                    'name' => 'Single-Sided',
                    'is_active' => true,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 50.00],
                    ],
                ],
            ],
        ];

        $product = $this->createGsmProduct(['printing_pricing' => $config]);
        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Selected GSM option '350 GSM Heavy Card' is currently inactive.");

        $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_350',
            'printing_side_id' => 'front_only',
        ]);
    }

    /**
     * Test explicit invalid printing side selection is rejected with InvalidArgumentException.
     */
    public function test_invalid_printing_side_selection_rejected(): void
    {
        $product = $this->createGsmProduct();
        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Selected printing configuration 'triple_sided' is invalid or unavailable for this product.");

        $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'triple_sided',
        ]);
    }

    /**
     * Test explicit inactive printing side selection is rejected with InvalidArgumentException.
     */
    public function test_inactive_printing_side_selection_rejected(): void
    {
        $config = [
            'enabled' => true,
            'options' => [
                [
                    'id' => 'special_emboss_side',
                    'name' => 'Special Emboss Side',
                    'is_active' => false,
                    'tiers' => [
                        ['quantity' => 100, 'total_price' => 60.00],
                    ],
                ],
            ],
        ];

        $product = $this->createGsmProduct(['printing_pricing' => $config]);
        $calculator = new PricingCalculatorService();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("Selected printing configuration 'Special Emboss Side' is currently inactive.");

        $calculator->calculate($product, 100, [
            'printing_side_id' => 'special_emboss_side',
        ]);
    }

    /**
     * Test that paper stock or GSM attribute modifiers are not charged twice when fixed-total printing pricing is active.
     */
    public function test_gsm_or_stock_modifiers_are_not_charged_twice(): void
    {
        $product = $this->createGsmProduct();

        $attr = ProductAttribute::create([
            'product_id' => $product->id,
            'name' => 'Paper Stock',
            'code' => 'paper_stock',
            'type' => 'select',
            'is_required' => false,
            'sort_order' => 1,
        ]);
        ProductAttributeValue::create([
            'product_attribute_id' => $attr->id,
            'label' => 'Standard Art Paper',
            'value' => 'Standard Art Paper',
            'price_modifier_type' => 'fixed',
            'price_modifier_amount' => 0.15,
            'sort_order' => 1,
        ]);

        $calculator = new PricingCalculatorService();

        // 128 GSM single-sided 100 qty has authoritative fixed total $20.00
        $result = $calculator->calculate($product->fresh(), 100, [
            'gsm_id' => 'gsm_128',
            'paper_stock' => 'Standard Art Paper',
            'printing_side_id' => 'front_only',
        ]);

        // Base printing subtotal must be exactly $20.00, NOT $20.00 + (100 * $0.15)
        $this->assertEquals(20.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(20.00, $result['subtotal_ex_gst']);
    }

    /**
     * Test that legitimate finish modifiers (like lamination or foil) still apply on top of fixed-total pricing.
     */
    public function test_legitimate_finish_modifiers_still_apply(): void
    {
        $product = $this->createGsmProduct();

        $attr = ProductAttribute::create([
            'product_id' => $product->id,
            'name' => 'Finish',
            'code' => 'finish',
            'type' => 'select',
            'is_required' => false,
            'sort_order' => 1,
        ]);
        ProductAttributeValue::create([
            'product_attribute_id' => $attr->id,
            'label' => 'Gloss Lamination',
            'value' => 'gloss_lamination',
            'price_modifier_type' => 'fixed',
            'price_modifier_amount' => 0.10,
            'sort_order' => 1,
        ]);

        $calculator = new PricingCalculatorService();

        // 128 GSM single-sided 100 qty = $20.00 fixed total
        // Finish modifier: $0.10 * 100 = $10.00
        // Expected subtotal ex GST = $30.00
        $result = $calculator->calculate($product->fresh(), 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
            'finish' => 'gloss_lamination',
        ]);

        $this->assertEquals(30.00, $result['base_printing_subtotal_ex_gst']);
        $this->assertEquals(30.00, $result['subtotal_ex_gst']);
        $this->assertEquals(3.00, $result['gst_amount']);
        $this->assertEquals(33.00, $result['total_inc_gst']);
    }

    /**
     * Test that folding options with distinct pricing methods (per_order, per_copy, quantity_based)
     * are each charged exactly once without duplication.
     */
    public function test_folding_charged_once_for_each_pricing_method(): void
    {
        $foldingConfig = [
            'enabled' => true,
            'options' => [
                [
                    'id' => 'per_order_fold',
                    'name' => 'Per Order Fold',
                    'pricing_method' => 'per_order',
                    'charge' => 15.00,
                    'is_active' => true,
                ],
                [
                    'id' => 'per_copy_fold',
                    'name' => 'Per Copy Fold',
                    'pricing_method' => 'per_copy',
                    'charge' => 0.05,
                    'is_active' => true,
                ],
                [
                    'id' => 'quantity_based_fold',
                    'name' => 'Quantity Based Fold',
                    'pricing_method' => 'quantity_based',
                    'tiers' => [
                        ['min_quantity' => 1, 'max_quantity' => 100, 'price' => 12.00],
                        ['min_quantity' => 101, 'max_quantity' => 500, 'price' => 20.00],
                    ],
                    'is_active' => true,
                ],
            ],
        ];

        $product = $this->createGsmProduct(['folding_pricing' => $foldingConfig]);
        $calculator = new PricingCalculatorService();

        // 1. per_order: $20.00 + $15.00 = $35.00
        $resOrder = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
            'folding_style' => 'per_order_fold',
        ]);
        $this->assertEquals(15.00, $resOrder['folding_charge_ex_gst']);
        $this->assertEquals(35.00, $resOrder['subtotal_ex_gst']);

        // 2. per_copy: $20.00 + (100 * $0.05) = $25.00
        $resCopy = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
            'folding_style' => 'per_copy_fold',
        ]);
        $this->assertEquals(5.00, $resCopy['folding_charge_ex_gst']);
        $this->assertEquals(25.00, $resCopy['subtotal_ex_gst']);

        // 3. quantity_based: tier 1-100 is $12.00 -> $20.00 + $12.00 = $32.00
        $resQty = $calculator->calculate($product, 100, [
            'gsm_id' => 'gsm_128',
            'printing_side_id' => 'front_only',
            'folding_style' => 'quantity_based_fold',
        ]);
        $this->assertEquals(12.00, $resQty['folding_charge_ex_gst']);
        $this->assertEquals(32.00, $resQty['subtotal_ex_gst']);
    }
}

