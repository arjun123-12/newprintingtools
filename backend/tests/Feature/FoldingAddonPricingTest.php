<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Pricing\PricingCalculatorService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class FoldingAddonPricingTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Folding Pricing Tester',
            'email' => 'admin_pricing_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Brochures & Flyers',
            'slug' => 'brochures-flyers-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Saving a product with folding add-on pricing configuration persists to database.
     */
    public function test_save_product_with_folding_pricing_configuration(): void
    {
        $foldingConfig = [
            'enabled' => true,
            'apply_to_option' => 'all',
            'pricing_method' => 'quantity_based',
            'charge' => 0,
            'tiers' => [
                ['min_quantity' => 100, 'max_quantity' => 249, 'price' => 10.00],
                ['min_quantity' => 250, 'max_quantity' => 499, 'price' => 20.00],
                ['min_quantity' => 500, 'max_quantity' => 999, 'price' => 35.00],
                ['min_quantity' => 1000, 'max_quantity' => null, 'price' => 60.00],
            ],
            'options' => [
                ['id' => 'half_fold', 'name' => 'Half Fold', 'is_active' => true, 'is_default' => false, 'charge' => 10.00],
                ['id' => 'tri_fold', 'name' => 'Tri-Fold / Letter Fold', 'is_active' => true, 'is_default' => true, 'charge' => 15.00],
                ['id' => 'z_fold', 'name' => 'Z-Fold', 'is_active' => true, 'is_default' => false, 'charge' => 20.00],
            ],
        ];

        $attributes = [
            [
                'name' => 'Folding',
                'code' => 'folding_style',
                'type' => 'select',
                'is_required' => false,
                'values' => [
                    ['label' => 'No Folding', 'value' => 'no_fold', 'is_active' => true, 'price_modifier_amount' => 0],
                    ['label' => 'Half Fold', 'value' => 'half_fold', 'is_active' => true, 'price_modifier_amount' => 10],
                    ['label' => 'Tri-Fold / Letter Fold', 'value' => 'tri_fold', 'is_active' => true, 'price_modifier_amount' => 15],
                ],
            ],
        ];

        $payload = [
            'category_id' => $this->category->id,
            'name' => 'Gloss Tri-Fold Brochure',
            'slug' => 'gloss-trifold-' . uniqid(),
            'sku' => 'TF-' . strtoupper(uniqid()),
            'base_price' => 50.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 297.0,
            'height_mm' => 210.0,
            'margin_mm' => 3.0,
            'bleed_mm' => 2.0,
            'safe_area_mm' => 3.0,
            'folding_pricing' => $foldingConfig,
            'attributes' => $attributes,
            'pricing_tiers' => [
                ['minQuantity' => 100, 'price' => 50.00],
                ['minQuantity' => 250, 'price' => 90.00],
                ['minQuantity' => 500, 'price' => 150.00],
                ['minQuantity' => 1000, 'price' => 250.00],
            ],
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201);
        $productId = $response->json('data.id');

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'name' => 'Gloss Tri-Fold Brochure',
        ]);

        $product = Product::with(['attributes.values', 'pricingMatrices'])->findOrFail($productId);
        $this->assertNotNull($product->folding_pricing);
        $this->assertTrue($product->folding_pricing['enabled']);
        $this->assertEquals('quantity_based', $product->folding_pricing['pricing_method']);
        $this->assertCount(4, $product->folding_pricing['tiers']);

        // Check attributes saved
        $this->assertCount(1, $product->attributes);
        $this->assertEquals('Folding', $product->attributes->first()->name);
        $this->assertCount(3, $product->attributes->first()->values);
    }

    /**
     * Test 2: Loading an existing product returns folding_pricing and attribute configurations.
     */
    public function test_load_product_returns_folding_pricing_and_attributes(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Premium Menu',
            'slug' => 'premium-menu-' . uniqid(),
            'sku' => 'MENU-' . strtoupper(uniqid()),
            'base_price' => 40.00,
            'product_type' => 'standard_print',
            'min_quantity' => 50,
            'turnaround_days' => 2,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_order',
                'charge' => 25.00,
                'tiers' => [],
            ],
        ]);

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->getJson("/api/v1/admin/products/{$product->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'id' => $product->id,
                'folding_pricing' => [
                    'enabled' => true,
                    'pricing_method' => 'per_order',
                    'charge' => 25.00,
                ],
            ],
        ]);
    }

    /**
     * Test 3: PricingCalculatorService with Quantity-based Folding Pricing (from the prompt example table).
     */
    public function test_pricing_calculator_quantity_based_folding_charge(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Folded Flyer Test',
            'slug' => 'folded-flyer-' . uniqid(),
            'sku' => 'FF-' . strtoupper(uniqid()),
            'base_price' => 50.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'quantity_based',
                'charge' => 0,
                'tiers' => [
                    ['min_quantity' => 100, 'max_quantity' => 249, 'price' => 10.00],
                    ['min_quantity' => 250, 'max_quantity' => 499, 'price' => 20.00],
                    ['min_quantity' => 500, 'max_quantity' => 999, 'price' => 35.00],
                    ['min_quantity' => 1000, 'max_quantity' => null, 'price' => 60.00],
                ],
                'options' => [
                    ['id' => 'tri_fold', 'name' => 'Tri-Fold', 'is_active' => true],
                ],
            ],
        ]);

        // Pricing matrices representing base printing price from prompt example table:
        // 100 qty -> $50.00 ($0.50/unit)
        // 250 qty -> $90.00 ($0.36/unit)
        // 500 qty -> $150.00 ($0.30/unit)
        // 1000 qty -> $250.00 ($0.25/unit)
        $product->pricingMatrices()->createMany([
            ['quantity' => 100, 'unit_price_ex_gst' => 0.50, 'setup_fee' => 0, 'discount_percentage' => 0],
            ['quantity' => 250, 'unit_price_ex_gst' => 0.36, 'setup_fee' => 0, 'discount_percentage' => 0],
            ['quantity' => 500, 'unit_price_ex_gst' => 0.30, 'setup_fee' => 0, 'discount_percentage' => 0],
            ['quantity' => 1000, 'unit_price_ex_gst' => 0.25, 'setup_fee' => 0, 'discount_percentage' => 0],
        ]);

        // Test Qty 100: Base $50.00 + Folding $10.00 = Subtotal $60.00
        $res100 = $calculator->calculate($product, 100, ['folding_style' => 'tri_fold']);
        $this->assertEquals(50.00, $res100['base_printing_subtotal_ex_gst']);
        $this->assertEquals(10.00, $res100['folding_charge_ex_gst']);
        $this->assertEquals(60.00, $res100['subtotal_ex_gst']);

        // Test Qty 250: Base $90.00 + Folding $20.00 = Subtotal $110.00
        $res250 = $calculator->calculate($product, 250, ['folding_style' => 'tri_fold']);
        $this->assertEquals(90.00, $res250['base_printing_subtotal_ex_gst']);
        $this->assertEquals(20.00, $res250['folding_charge_ex_gst']);
        $this->assertEquals(110.00, $res250['subtotal_ex_gst']);

        // Test Qty 500: Base $150.00 + Folding $35.00 = Subtotal $185.00
        $res500 = $calculator->calculate($product, 500, ['folding_style' => 'tri_fold']);
        $this->assertEquals(150.00, $res500['base_printing_subtotal_ex_gst']);
        $this->assertEquals(35.00, $res500['folding_charge_ex_gst']);
        $this->assertEquals(185.00, $res500['subtotal_ex_gst']);

        // Test Qty 1000: Base $250.00 + Folding $60.00 = Subtotal $310.00
        $res1000 = $calculator->calculate($product, 1000, ['folding_style' => 'tri_fold']);
        $this->assertEquals(250.00, $res1000['base_printing_subtotal_ex_gst']);
        $this->assertEquals(60.00, $res1000['folding_charge_ex_gst']);
        $this->assertEquals(310.00, $res1000['subtotal_ex_gst']);
    }

    /**
     * Test 4: PricingCalculatorService with Per-Order folding pricing.
     */
    public function test_pricing_calculator_per_order_folding_charge(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Per Order Brochure',
            'slug' => 'per-order-brochure-' . uniqid(),
            'sku' => 'POB-' . strtoupper(uniqid()),
            'base_price' => 1.00,
            'product_type' => 'standard_print',
            'min_quantity' => 10,
            'turnaround_days' => 1,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_order',
                'charge' => 15.00,
            ],
        ]);

        $res = $calculator->calculate($product, 200, ['folding_style' => 'half_fold']);
        $this->assertEquals(200.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertEquals(15.00, $res['folding_charge_ex_gst']);
        $this->assertEquals(215.00, $res['subtotal_ex_gst']);
    }

    /**
     * Test 5: PricingCalculatorService with Per-Printed-Copy folding pricing (multiplied by qty once).
     */
    public function test_pricing_calculator_per_copy_folding_charge(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Per Copy Brochure',
            'slug' => 'per-copy-brochure-' . uniqid(),
            'sku' => 'PCB-' . strtoupper(uniqid()),
            'base_price' => 0.50,
            'product_type' => 'standard_print',
            'min_quantity' => 50,
            'turnaround_days' => 1,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_copy',
                'charge' => 0.05,
            ],
        ]);

        // 300 copies: base = 300 * 0.50 = 150.00, folding = 300 * 0.05 = 15.00
        $res = $calculator->calculate($product, 300, ['folding_style' => 'z_fold']);
        $this->assertEquals(150.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertEquals(15.00, $res['folding_charge_ex_gst']);
        $this->assertEquals(165.00, $res['subtotal_ex_gst']);
    }

    /**
     * Test 6: Inactive folding options are rejected by the backend calculator.
     */
    public function test_inactive_folding_option_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Restricted Fold Product',
            'slug' => 'restricted-fold-' . uniqid(),
            'sku' => 'RFP-' . strtoupper(uniqid()),
            'base_price' => 10.00,
            'product_type' => 'standard_print',
            'min_quantity' => 1,
            'turnaround_days' => 1,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_order',
                'charge' => 10.00,
                'options' => [
                    ['id' => 'gate_fold', 'name' => 'Gate Fold', 'is_active' => false],
                ],
            ],
        ]);

        $calculator->calculate($product, 10, ['folding_style' => 'gate_fold']);
    }

    /**
     * Test 7: When folding is disabled, no folding charge is added.
     */
    public function test_no_folding_charge_when_disabled(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Flat Postcard',
            'slug' => 'flat-postcard-' . uniqid(),
            'sku' => 'FPC-' . strtoupper(uniqid()),
            'base_price' => 0.80,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 1,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => false,
                'charge' => 50.00,
            ],
        ]);

        $res = $calculator->calculate($product, 100, ['folding_style' => 'half_fold']);
        $this->assertEquals(80.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertEquals(0.00, $res['folding_charge_ex_gst']);
        $this->assertEquals(80.00, $res['subtotal_ex_gst']);
    }

    /**
     * Test 8: Selecting 'No Folding' produces 0.00 folding charge even when folding is enabled.
     */
    public function test_no_folding_option_selection_produces_zero_charge(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Brochure or Flat Flyer',
            'slug' => 'brochure-flat-' . uniqid(),
            'sku' => 'BFF-' . strtoupper(uniqid()),
            'base_price' => 1.50,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_order',
                'charge' => 30.00,
                'options' => [
                    ['id' => 'no_fold', 'name' => 'No Folding (Flat Sheet)', 'type' => 'no_fold', 'is_active' => true, 'charge' => 0],
                    ['id' => 'tri_fold', 'name' => 'Tri-Fold', 'type' => 'tri_fold', 'is_active' => true, 'charge' => 30],
                ],
            ],
        ]);

        $res = $calculator->calculate($product, 100, ['folding_style' => 'no_fold']);
        $this->assertEquals(150.00, $res['base_printing_subtotal_ex_gst']);
        $this->assertEquals(0.00, $res['folding_charge_ex_gst']);
        $this->assertEquals(150.00, $res['subtotal_ex_gst']);
    }

    /**
     * Test 9: Quantity outside configured tiers throws an InvalidArgumentException.
     */
    public function test_quantity_outside_tiers_throws_exception(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Strict Tier Product',
            'slug' => 'strict-tier-' . uniqid(),
            'sku' => 'STP-' . strtoupper(uniqid()),
            'base_price' => 1.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'quantity_based',
                'tiers' => [
                    ['min_quantity' => 100, 'max_quantity' => 500, 'price' => 25.00],
                ],
                'options' => [
                    ['id' => 'half_fold', 'name' => 'Half Fold', 'is_active' => true],
                ],
            ],
        ]);

        // 50 is below min_quantity 100
        $calculator->calculate($product, 50, ['folding_style' => 'half_fold']);
    }

    /**
     * Test 10: Product with distinct pricing methods per option (e.g. one per_order, one per_copy).
     */
    public function test_options_with_distinct_pricing_methods(): void
    {
        $calculator = new PricingCalculatorService();

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Multi Option Fold Product',
            'slug' => 'multi-opt-fold-' . uniqid(),
            'sku' => 'MOF-' . strtoupper(uniqid()),
            'base_price' => 0.50,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'folding_pricing' => [
                'enabled' => true,
                'pricing_method' => 'per_order',
                'options' => [
                    ['id' => 'half_fold', 'name' => 'Half Fold', 'type' => 'half_fold', 'pricing_method' => 'per_order', 'charge' => 15.00, 'is_active' => true],
                    ['id' => 'tri_fold', 'name' => 'Tri-Fold', 'type' => 'tri_fold', 'pricing_method' => 'per_copy', 'charge' => 0.08, 'is_active' => true],
                ],
            ],
        ]);

        // Half fold (per_order): $15 flat
        $resHalf = $calculator->calculate($product, 200, ['folding_style' => 'half_fold']);
        $this->assertEquals(100.00, $resHalf['base_printing_subtotal_ex_gst']);
        $this->assertEquals(15.00, $resHalf['folding_charge_ex_gst']);
        $this->assertEquals(115.00, $resHalf['subtotal_ex_gst']);

        // Tri fold (per_copy): 200 * $0.08 = $16.00
        $resTri = $calculator->calculate($product, 200, ['folding_style' => 'tri_fold']);
        $this->assertEquals(100.00, $resTri['base_printing_subtotal_ex_gst']);
        $this->assertEquals(16.00, $resTri['folding_charge_ex_gst']);
        $this->assertEquals(116.00, $resTri['subtotal_ex_gst']);
    }
}
