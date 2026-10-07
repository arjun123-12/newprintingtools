<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AdminProductTemplateLayoutTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $category;
    protected Product $standardProduct;
    protected Product $trifoldProduct;
    protected Product $doubleSidedProduct;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Product-Template Tester',
            'email' => 'admin_tpl_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Flyers & Templates',
            'slug' => 'flyers-tpl-' . uniqid(),
            'is_active' => true,
        ]);

        // Standard flyer product
        $this->standardProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Standard Flyer A5',
            'slug' => 'std-flyer-' . uniqid(),
            'sku' => 'FLYER-' . uniqid(),
            'base_price' => 25.00,
            'is_active' => true,
            'width_mm' => 148.00,
            'height_mm' => 210.00,
            'bleed_mm' => 3.00,
            'safe_area_mm' => 4.00,
            'margin_mm' => 5.00,
            'print_sides' => 'front',
        ]);

        // Tri-fold flyer product with print_layout
        $this->trifoldProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'A4 Tri-Fold Restaurant Flyer',
            'slug' => 'trifold-flyer-' . uniqid(),
            'sku' => 'TRIFOLD-' . uniqid(),
            'base_price' => 49.99,
            'is_active' => true,
            'width_mm' => 297.00,
            'height_mm' => 210.00,
            'bleed_mm' => 3.00,
            'safe_area_mm' => 5.00,
            'margin_mm' => 0.00,
            'print_sides' => 'both',
            'print_layout' => [
                'width' => 297,
                'height' => 210,
                'orientation' => 'landscape',
                'outerBleed' => ['top' => 3, 'right' => 3, 'bottom' => 3, 'left' => 3],
                'safeMargin' => ['top' => 5, 'right' => 5, 'bottom' => 5, 'left' => 5],
                'folding' => [
                    'enabled' => true,
                    'type' => 'tri-fold',
                    'panelOrientation' => 'vertical',
                    'panelCount' => 3,
                    'panels' => [
                        ['id' => 'p1', 'index' => 0, 'label' => 'Panel 1 (Flap)', 'width' => 97],
                        ['id' => 'p2', 'index' => 1, 'label' => 'Panel 2 (Back)', 'width' => 100],
                        ['id' => 'p3', 'index' => 2, 'label' => 'Panel 3 (Front)', 'width' => 100],
                    ],
                    'folds' => [
                        [
                            'id' => 'f1',
                            'index' => 0,
                            'position' => 97,
                            'marginLeft' => 4,
                            'marginRight' => 4,
                            'bleedLeft' => 1.5,
                            'bleedRight' => 1.5,
                        ],
                        [
                            'id' => 'f2',
                            'index' => 1,
                            'position' => 197,
                            'marginLeft' => 4,
                            'marginRight' => 4,
                            'bleedLeft' => 1.5,
                            'bleedRight' => 1.5,
                        ],
                    ],
                    'sameMarginForAllFolds' => true,
                    'sameBleedForAllFolds' => true,
                    'uniformFoldMargin' => 4,
                    'uniformFoldBleed' => 1.5,
                ],
            ],
        ]);
    }

    /**
     * Test 1: Template creation requires valid product_id.
     */
    public function test_template_creation_requires_valid_product(): void
    {
        $payloadWithoutProduct = [
            'name' => 'Template Without Product',
            'category' => 'Corporate',
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payloadWithoutProduct);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['product_id']);
    }

    /**
     * Test 2: Template creation with normal product links product and resolves layout.
     */
    public function test_create_template_with_standard_product(): void
    {
        $payload = [
            'product_id' => $this->standardProduct->id,
            'name' => 'Corporate A5 Flyer Template',
            'category' => 'Corporate',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [],
                'background' => '#ffffff',
            ],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Corporate A5 Flyer Template',
                    'product_id' => $this->standardProduct->id,
                    'product' => [
                        'id' => $this->standardProduct->id,
                        'name' => 'Standard Flyer A5',
                        'width_mm' => '148.00',
                        'height_mm' => '210.00',
                    ],
                ],
            ]);

        $templateId = $response->json('data.id');
        $this->assertNotNull($templateId);

        $template = DesignTemplate::with('product')->findOrFail($templateId);
        $this->assertEquals(148.00, (float) $template->resolved_print_settings['width_mm']);
        $this->assertEquals(210.00, (float) $template->resolved_print_settings['height_mm']);
        $this->assertEquals(3.00, (float) $template->resolved_print_settings['bleed_mm']);
        $this->assertEquals(4.00, (float) $template->resolved_print_settings['safe_area_mm']);
    }

    /**
     * Test 3: Template creation with tri-fold product includes full folding print_layout.
     */
    public function test_create_template_with_trifold_product_inherits_folding_layout(): void
    {
        $payload = [
            'product_id' => $this->trifoldProduct->id,
            'name' => 'Modern Italian Restaurant Tri-Fold',
            'category' => 'Food',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [
                    [
                        'type' => 'textbox',
                        'text' => 'Buon Appetito',
                        'left' => 50,
                        'top' => 50,
                    ],
                ],
                'background' => '#fffdfa',
            ],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201);
        $templateId = $response->json('data.id');

        // Fetch through show endpoint
        $showResponse = $this->actingAs($this->adminUser)
            ->getJson("/api/v1/admin/templates/{$templateId}");

        $showResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $templateId,
                    'product_id' => $this->trifoldProduct->id,
                    'product' => [
                        'id' => $this->trifoldProduct->id,
                        'name' => 'A4 Tri-Fold Restaurant Flyer',
                    ],
                ],
            ]);

        // Verify product print_layout is included in product relation
        $productLayout = $showResponse->json('data.product.print_layout');
        $this->assertNotNull($productLayout);
        $this->assertTrue($productLayout['folding']['enabled']);
        $this->assertEquals('tri-fold', $productLayout['folding']['type']);
        $this->assertCount(3, $productLayout['folding']['panels']);
        $this->assertEquals(97, $productLayout['folding']['panels'][0]['width']);
        $this->assertEquals(100, $productLayout['folding']['panels'][1]['width']);
        $this->assertEquals(100, $productLayout['folding']['panels'][2]['width']);
        $this->assertCount(2, $productLayout['folding']['folds']);

        // Verify template document_settings contains print_layout
        $docSettings = $showResponse->json('data.document_settings');
        $this->assertNotNull($docSettings['print_layout']);
        $this->assertEquals(297, $docSettings['width']);
        $this->assertEquals(210, $docSettings['height']);
    }

    /**
     * Test 4: Templates on basic products without folding maintain backward compatibility.
     */
    public function test_legacy_template_without_folding_maintains_backward_compatibility(): void
    {
        $basicProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Legacy Business Card',
            'slug' => 'legacy-card-' . uniqid(),
            'sku' => 'CARD-' . uniqid(),
            'base_price' => 15.00,
            'is_active' => true,
            'width_mm' => 90.00,
            'height_mm' => 50.00,
            'margin_mm' => 2.00,
            'bleed_mm' => 3.00,
            'safe_area_mm' => 3.00,
            'print_sides' => 'front',
            'print_layout' => null, // No folding layout
        ]);

        $template = DesignTemplate::create([
            'product_id' => $basicProduct->id,
            'name' => 'Legacy Standalone Template',
            'category' => 'General',
            'width_mm' => 90.00,
            'height_mm' => 50.00,
            'margin_mm' => 2.00,
            'bleed_mm' => 3.00,
            'safe_area_mm' => 3.00,
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);

        $resolved = $template->resolved_print_settings;
        $this->assertEquals(90.00, (float) $resolved['width_mm']);
        $this->assertEquals(50.00, (float) $resolved['height_mm']);
        $this->assertEquals(3.00, (float) $resolved['bleed_mm']);
        $this->assertNull($resolved['print_layout']);

        $showResponse = $this->actingAs($this->adminUser)
            ->getJson("/api/v1/admin/templates/{$template->id}");

        $showResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $template->id,
                    'name' => 'Legacy Standalone Template',
                    'product_id' => $basicProduct->id,
                    'document_settings' => [
                        'width' => 90,
                        'height' => 50,
                        'print_layout' => null,
                    ],
                ],
            ]);
    }
}
