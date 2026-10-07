<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class FoldingAndPrintLayoutTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Layout Tester',
            'email' => 'admin_layout_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Brochures & Folders',
            'slug' => 'brochures-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Creating a non-folding product works exactly as before.
     */
    public function test_create_product_without_folding(): void
    {
        $payload = [
            'category_id' => $this->category->id,
            'name' => 'Standard Flyer A5',
            'slug' => 'standard-flyer-' . uniqid(),
            'sku' => 'FLYER-' . strtoupper(uniqid()),
            'base_price' => 19.99,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 2,
            'is_active' => true,
            'print_sides' => 'front',
            'width_mm' => 148.0,
            'height_mm' => 210.0,
            'margin_mm' => 3.0,
            'bleed_mm' => 2.0,
            'safe_area_mm' => 3.0,
            'print_layout' => null,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Standard Flyer A5',
                    'width_mm' => 148.0,
                    'height_mm' => 210.0,
                    'bleed_mm' => 2.0,
                    'safe_area_mm' => 3.0,
                    'print_layout' => null,
                ],
            ]);
    }

    /**
     * Test 2: Creating a product with Bi-Fold folding configuration.
     */
    public function test_create_product_with_bifold_folding(): void
    {
        $bifoldLayout = [
            'width' => 148.0,
            'height' => 105.0,
            'orientation' => 'landscape',
            'outerBleed' => [
                'top' => 3.0,
                'right' => 3.0,
                'bottom' => 3.0,
                'left' => 3.0,
            ],
            'safeMargin' => [
                'top' => 4.0,
                'right' => 4.0,
                'bottom' => 4.0,
                'left' => 4.0,
            ],
            'folding' => [
                'enabled' => true,
                'type' => 'bi-fold',
                'panelOrientation' => 'vertical',
                'panelCount' => 2,
                'panels' => [
                    ['id' => 'p1', 'index' => 0, 'label' => 'Panel 1', 'width' => 74.0],
                    ['id' => 'p2', 'index' => 1, 'label' => 'Panel 2', 'width' => 74.0],
                ],
                'folds' => [
                    [
                        'id' => 'f1',
                        'index' => 0,
                        'position' => 74.0,
                        'marginLeft' => 3.0,
                        'marginRight' => 3.0,
                        'bleedLeft' => 2.0,
                        'bleedRight' => 2.0,
                        'allowance' => 0.0,
                    ],
                ],
                'sameMarginForAllFolds' => true,
                'sameBleedForAllFolds' => true,
                'uniformFoldMargin' => 3.0,
                'uniformFoldBleed' => 2.0,
            ],
        ];

        $payload = [
            'category_id' => $this->category->id,
            'name' => 'Bi-Fold Greeting Card',
            'slug' => 'bifold-card-' . uniqid(),
            'sku' => 'BIFOLD-' . strtoupper(uniqid()),
            'base_price' => 24.50,
            'product_type' => 'standard_print',
            'min_quantity' => 50,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 148.0,
            'height_mm' => 105.0,
            'margin_mm' => 4.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 4.0,
            'print_layout' => $bifoldLayout,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertNotNull($data['print_layout']);
        $this->assertTrue($data['print_layout']['folding']['enabled']);
        $this->assertEquals('bi-fold', $data['print_layout']['folding']['type']);
        $this->assertCount(2, $data['print_layout']['folding']['panels']);
        $this->assertCount(1, $data['print_layout']['folding']['folds']);
        $this->assertEquals(74.0, $data['print_layout']['folding']['folds'][0]['position']);
    }

    /**
     * Test 3: Creating a Tri-Fold product with custom, unequal panel widths (100mm, 97mm, 100mm).
     */
    public function test_create_product_with_trifold_folding_and_custom_panels(): void
    {
        $trifoldLayout = [
            'width' => 297.0,
            'height' => 210.0,
            'orientation' => 'landscape',
            'outerBleed' => [
                'top' => 3.0,
                'right' => 3.0,
                'bottom' => 3.0,
                'left' => 3.0,
            ],
            'safeMargin' => [
                'top' => 5.0,
                'right' => 5.0,
                'bottom' => 5.0,
                'left' => 5.0,
            ],
            'folding' => [
                'enabled' => true,
                'type' => 'tri-fold',
                'panelOrientation' => 'vertical',
                'panelCount' => 3,
                'panels' => [
                    ['id' => 'p1', 'index' => 0, 'label' => 'Panel 1 (Outer)', 'width' => 100.0],
                    ['id' => 'p2', 'index' => 1, 'label' => 'Panel 2 (Center)', 'width' => 97.0],
                    ['id' => 'p3', 'index' => 2, 'label' => 'Panel 3 (Inner)', 'width' => 100.0],
                ],
                'folds' => [
                    [
                        'id' => 'f1',
                        'index' => 0,
                        'position' => 100.0,
                        'marginLeft' => 3.0,
                        'marginRight' => 3.0,
                        'bleedLeft' => 2.0,
                        'bleedRight' => 2.0,
                        'allowance' => 0.0,
                    ],
                    [
                        'id' => 'f2',
                        'index' => 1,
                        'position' => 197.0,
                        'marginLeft' => 4.0,
                        'marginRight' => 4.0,
                        'bleedLeft' => 2.5,
                        'bleedRight' => 2.5,
                        'allowance' => 0.5,
                    ],
                ],
                'sameMarginForAllFolds' => false,
                'sameBleedForAllFolds' => false,
            ],
        ];

        $payload = [
            'category_id' => $this->category->id,
            'name' => 'A4 Tri-Fold Brochure',
            'slug' => 'trifold-brochure-' . uniqid(),
            'sku' => 'TRIFOLD-' . strtoupper(uniqid()),
            'base_price' => 45.00,
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 4,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 297.0,
            'height_mm' => 210.0,
            'margin_mm' => 5.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 5.0,
            'print_layout' => $trifoldLayout,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertEquals(297.0, $data['width_mm']);
        $this->assertEquals(210.0, $data['height_mm']);
        $this->assertEquals('tri-fold', $data['print_layout']['folding']['type']);

        // Check custom panel widths
        $panels = $data['print_layout']['folding']['panels'];
        $this->assertEquals(100.0, $panels[0]['width']);
        $this->assertEquals(97.0, $panels[1]['width']);
        $this->assertEquals(100.0, $panels[2]['width']);

        // Check individual fold configurations
        $folds = $data['print_layout']['folding']['folds'];
        $this->assertEquals(100.0, $folds[0]['position']);
        $this->assertEquals(197.0, $folds[1]['position']);
        $this->assertEquals(3.0, $folds[0]['marginLeft']);
        $this->assertEquals(4.0, $folds[1]['marginLeft']);
        $this->assertEquals(0.5, $folds[1]['allowance']);
    }

    /**
     * Test 4: Updating folding configuration persists correctly.
     */
    public function test_update_product_folding_configuration_persists(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Brochure Base',
            'slug' => 'brochure-base-' . uniqid(),
            'sku' => 'BROCH-' . strtoupper(uniqid()),
            'base_price' => 30.00,
            'product_type' => 'standard_print',
            'min_quantity' => 1,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'front',
            'width_mm' => 297.0,
            'height_mm' => 210.0,
            'margin_mm' => 3.0,
            'bleed_mm' => 2.0,
            'safe_area_mm' => 3.0,
            'print_layout' => null,
        ]);

        $updatedLayout = [
            'width' => 297.0,
            'height' => 210.0,
            'orientation' => 'landscape',
            'outerBleed' => ['top' => 3.0, 'right' => 3.0, 'bottom' => 3.0, 'left' => 3.0],
            'safeMargin' => ['top' => 5.0, 'right' => 5.0, 'bottom' => 5.0, 'left' => 5.0],
            'folding' => [
                'enabled' => true,
                'type' => 'z-fold',
                'panelOrientation' => 'vertical',
                'panelCount' => 3,
                'panels' => [
                    ['id' => 'p1', 'index' => 0, 'label' => 'Panel 1', 'width' => 99.0],
                    ['id' => 'p2', 'index' => 1, 'label' => 'Panel 2', 'width' => 99.0],
                    ['id' => 'p3', 'index' => 2, 'label' => 'Panel 3', 'width' => 99.0],
                ],
                'folds' => [
                    ['id' => 'f1', 'index' => 0, 'position' => 99.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                    ['id' => 'f2', 'index' => 1, 'position' => 198.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                ],
                'sameMarginForAllFolds' => true,
                'sameBleedForAllFolds' => true,
            ],
        ];

        $updateResponse = $this->actingAs($this->adminUser, 'sanctum')
            ->patchJson("/api/v1/admin/products/{$product->id}", [
                'print_layout' => $updatedLayout,
            ]);

        $updateResponse->assertStatus(200);

        // Fetch product again via GET to verify persistence
        $getResponse = $this->actingAs($this->adminUser, 'sanctum')
            ->getJson("/api/v1/admin/products/{$product->id}");

        $getResponse->assertStatus(200);
        $fetchedLayout = $getResponse->json('data.print_layout');

        $this->assertNotNull($fetchedLayout);
        $this->assertEquals('z-fold', $fetchedLayout['folding']['type']);
        $this->assertEquals(99.0, $fetchedLayout['folding']['panels'][0]['width']);
        $this->assertEquals(198.0, $fetchedLayout['folding']['folds'][1]['position']);
    }

    /**
     * Test 5: Public customer endpoint returns print_layout configuration.
     */
    public function test_public_customer_api_returns_folding_layout(): void
    {
        $foldingLayout = [
            'width' => 297.0,
            'height' => 210.0,
            'orientation' => 'landscape',
            'outerBleed' => ['top' => 3.0, 'right' => 3.0, 'bottom' => 3.0, 'left' => 3.0],
            'safeMargin' => ['top' => 5.0, 'right' => 5.0, 'bottom' => 5.0, 'left' => 5.0],
            'folding' => [
                'enabled' => true,
                'type' => 'gate-fold',
                'panelOrientation' => 'vertical',
                'panelCount' => 3,
                'panels' => [
                    ['id' => 'p1', 'index' => 0, 'label' => 'Left Gate', 'width' => 74.25],
                    ['id' => 'p2', 'index' => 1, 'label' => 'Center', 'width' => 148.5],
                    ['id' => 'p3', 'index' => 2, 'label' => 'Right Gate', 'width' => 74.25],
                ],
                'folds' => [
                    ['id' => 'f1', 'index' => 0, 'position' => 74.25, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                    ['id' => 'f2', 'index' => 1, 'position' => 222.75, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                ],
                'sameMarginForAllFolds' => true,
                'sameBleedForAllFolds' => true,
            ],
        ];

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Gate Fold Leaflet',
            'slug' => 'gate-fold-' . uniqid(),
            'sku' => 'GATE-' . strtoupper(uniqid()),
            'base_price' => 35.00,
            'product_type' => 'standard_print',
            'min_quantity' => 1,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 297.0,
            'height_mm' => 210.0,
            'margin_mm' => 5.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 5.0,
            'print_layout' => $foldingLayout,
        ]);

        $response = $this->getJson("/api/v1/products/{$product->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $product->id,
                    'print_layout' => [
                        'folding' => [
                            'enabled' => true,
                            'type' => 'gate-fold',
                        ],
                    ],
                ],
            ]);
    }

    /**
     * Test 6: Front and Back sides maintain separate layout information.
     */
    public function test_front_and_back_folding_layout_configuration(): void
    {
        $frontPanels = [
            ['id' => 'p1', 'index' => 0, 'label' => 'Panel 1 (Outer)', 'width' => 100.0],
            ['id' => 'p2', 'index' => 1, 'label' => 'Panel 2 (Center)', 'width' => 97.0],
            ['id' => 'p3', 'index' => 2, 'label' => 'Panel 3 (Inner)', 'width' => 100.0],
        ];

        $backPanels = [
            ['id' => 'bp1', 'index' => 0, 'label' => 'Panel 3 (Inner)', 'width' => 100.0],
            ['id' => 'bp2', 'index' => 1, 'label' => 'Panel 2 (Center)', 'width' => 97.0],
            ['id' => 'bp3', 'index' => 2, 'label' => 'Panel 1 (Outer)', 'width' => 100.0],
        ];

        $layout = [
            'width' => 297.0,
            'height' => 210.0,
            'orientation' => 'landscape',
            'outerBleed' => ['top' => 3.0, 'right' => 3.0, 'bottom' => 3.0, 'left' => 3.0],
            'safeMargin' => ['top' => 5.0, 'right' => 5.0, 'bottom' => 5.0, 'left' => 5.0],
            'folding' => [
                'enabled' => true,
                'type' => 'tri-fold',
                'panelOrientation' => 'vertical',
                'panelCount' => 3,
                'panels' => $frontPanels,
                'folds' => [
                    ['id' => 'f1', 'index' => 0, 'position' => 100.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                    ['id' => 'f2', 'index' => 1, 'position' => 197.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                ],
                'sameMarginForAllFolds' => true,
                'sameBleedForAllFolds' => true,
                'sides' => [
                    'front' => [
                        'panels' => $frontPanels,
                        'folds' => [
                            ['id' => 'f1', 'index' => 0, 'position' => 100.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                            ['id' => 'f2', 'index' => 1, 'position' => 197.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                        ],
                    ],
                    'back' => [
                        'panels' => $backPanels,
                        'folds' => [
                            ['id' => 'bf1', 'index' => 0, 'position' => 100.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                            ['id' => 'bf2', 'index' => 1, 'position' => 197.0, 'marginLeft' => 3.0, 'marginRight' => 3.0, 'bleedLeft' => 2.0, 'bleedRight' => 2.0],
                        ],
                    ],
                ],
            ],
        ];

        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Double Sided Tri-Fold',
            'slug' => 'double-trifold-' . uniqid(),
            'sku' => 'DBL-TRI-' . strtoupper(uniqid()),
            'base_price' => 50.00,
            'product_type' => 'standard_print',
            'min_quantity' => 1,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 297.0,
            'height_mm' => 210.0,
            'margin_mm' => 5.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 5.0,
            'print_layout' => $layout,
        ]);

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->getJson("/api/v1/admin/products/{$product->id}");

        $response->assertStatus(200);
        $sides = $response->json('data.print_layout.folding.sides');

        $this->assertNotNull($sides['front']);
        $this->assertNotNull($sides['back']);
        $this->assertEquals(100.0, $sides['front']['panels'][0]['width']);
        $this->assertEquals(97.0, $sides['front']['panels'][1]['width']);
        $this->assertEquals(100.0, $sides['back']['panels'][0]['width']);
    }
}
