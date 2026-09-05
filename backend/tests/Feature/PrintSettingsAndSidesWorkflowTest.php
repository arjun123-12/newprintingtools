<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class PrintSettingsAndSidesWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_test_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Print Stationery',
            'slug' => 'print-stationery-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Creating a product with custom print settings.
     */
    public function test_create_product_with_custom_print_settings(): void
    {
        $payload = [
            'category_id' => $this->category->id,
            'name' => 'Folded Greeting Card',
            'slug' => 'folded-card-' . uniqid(),
            'sku' => 'CARD-' . strtoupper(uniqid()),
            'base_price' => 15.50,
            'product_type' => 'standard_print',
            'min_quantity' => 1,
            'turnaround_days' => 3,
            'is_active' => true,
            'print_sides' => 'both',
            'width_mm' => 148.5,
            'height_mm' => 105.0,
            'margin_mm' => 4.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 4.0,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/products', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'print_sides' => 'both',
                    'width_mm' => 148.5,
                    'height_mm' => 105.0,
                    'margin_mm' => 4.0,
                    'bleed_mm' => 3.0,
                    'safe_area_mm' => 4.0,
                ],
            ]);

        $this->assertDatabaseHas('products', [
            'name' => 'Folded Greeting Card',
            'print_sides' => 'both',
            'width_mm' => 148.5,
            'height_mm' => 105.0,
        ]);
    }

    /**
     * Test 2: Updating a product without losing existing values.
     */
    public function test_update_product_without_losing_existing_values(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Standard Postcard',
            'slug' => 'standard-postcard-' . uniqid(),
            'sku' => 'POST-' . strtoupper(uniqid()),
            'base_price' => 10.00,
            'print_sides' => 'front',
            'width_mm' => 100.0,
            'height_mm' => 150.0,
            'margin_mm' => 2.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 3.0,
            'is_active' => true,
        ]);

        // Partial update modifying only name
        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->patchJson("/api/v1/admin/products/{$product->id}", [
                'name' => 'Updated Standard Postcard',
            ]);

        $response->assertStatus(200);

        $product->refresh();
        $this->assertEquals('Updated Standard Postcard', $product->name);
        $this->assertEquals('front', $product->print_sides);
        $this->assertEquals('100.00', (string) $product->width_mm);
        $this->assertEquals('150.00', (string) $product->height_mm);
        $this->assertEquals('3.00', (string) $product->bleed_mm);
    }

    /**
     * Test 3: Creating a front-only template.
     */
    public function test_create_front_only_template(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Single Sided Poster',
            'slug' => 'poster-' . uniqid(),
            'sku' => 'PST-' . strtoupper(uniqid()),
            'base_price' => 25.00,
            'is_active' => true,
        ]);

        $payload = [
            'product_id' => $product->id,
            'name' => 'Front-Only Poster Template',
            'category' => 'Marketing',
            'print_sides' => 'front',
            'width_mm' => 210.0,
            'height_mm' => 297.0,
            'margin_mm' => 5.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 5.0,
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [['type' => 'textbox', 'text' => 'Front Poster']],
                'background' => '#ffffff',
            ],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/design-templates', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'print_sides' => 'front',
                    'width_mm' => 210.0,
                    'height_mm' => 297.0,
                ],
            ]);

        $this->assertDatabaseHas('design_templates', [
            'name' => 'Front-Only Poster Template',
            'print_sides' => 'front',
            'back_canvas_json' => null,
        ]);
    }

    /**
     * Test 4: Creating a both-side template with front and back JSON.
     */
    public function test_create_both_sides_template_with_front_and_back_json(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Business Card Dual',
            'slug' => 'biz-card-dual-' . uniqid(),
            'sku' => 'BCD-' . strtoupper(uniqid()),
            'base_price' => 30.00,
            'is_active' => true,
        ]);

        $frontJson = [
            'version' => '6.0.0',
            'objects' => [['type' => 'textbox', 'text' => 'John Doe - CEO']],
            'background' => '#ffffff',
        ];

        $backJson = [
            'version' => '6.0.0',
            'objects' => [['type' => 'textbox', 'text' => 'ACME Corp Logo']],
            'background' => '#0f172a',
        ];

        $payload = [
            'product_id' => $product->id,
            'name' => 'Corporate Dual Business Card',
            'category' => 'Corporate',
            'print_sides' => 'both',
            'width_mm' => 90.0,
            'height_mm' => 50.0,
            'margin_mm' => 2.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 3.0,
            'canvas_json' => $frontJson,
            'back_canvas_json' => $backJson,
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/design-templates', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'print_sides' => 'both',
                    'width_mm' => 90.0,
                    'height_mm' => 50.0,
                ],
            ]);

        $created = DesignTemplate::where('name', 'Corporate Dual Business Card')->firstOrFail();
        $this->assertEquals('both', $created->print_sides);
        $this->assertNotEmpty($created->canvas_json);
        $this->assertNotEmpty($created->back_canvas_json);
        $this->assertEquals('John Doe - CEO', $created->canvas_json['objects'][0]['text']);
        $this->assertEquals('ACME Corp Logo', $created->back_canvas_json['objects'][0]['text']);
    }

    /**
     * Test 5: Updating template metadata without clearing either canvas JSON.
     */
    public function test_updating_template_metadata_preserves_both_canvas_json(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Test Product',
            'slug' => 'test-prod-' . uniqid(),
            'sku' => 'TP-' . strtoupper(uniqid()),
            'base_price' => 20.00,
            'is_active' => true,
        ]);

        $template = DesignTemplate::create([
            'product_id' => $product->id,
            'name' => 'Initial Template Name',
            'category' => 'Corporate',
            'print_sides' => 'both',
            'width_mm' => 90.0,
            'height_mm' => 50.0,
            'margin_mm' => 2.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 3.0,
            'canvas_json' => ['version' => '6.0.0', 'objects' => [['text' => 'Front Saved']]],
            'back_canvas_json' => ['version' => '6.0.0', 'objects' => [['text' => 'Back Saved']]],
            'is_active' => true,
        ]);

        // Update ONLY name and category (omit canvas_json and back_canvas_json)
        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->putJson("/api/v1/admin/design-templates/{$template->id}", [
                'name' => 'Updated Template Title',
                'category' => 'Modern',
            ]);

        $response->assertStatus(200);

        $template->refresh();
        $this->assertEquals('Updated Template Title', $template->name);
        $this->assertEquals('Modern', $template->category);
        $this->assertEquals('Front Saved', $template->canvas_json['objects'][0]['text']);
        $this->assertEquals('Back Saved', $template->back_canvas_json['objects'][0]['text']);
    }

    /**
     * Test 6: Loading an old template that has only canvas_json.
     */
    public function test_loading_old_template_with_only_canvas_json(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Legacy Product',
            'slug' => 'legacy-product-' . uniqid(),
            'sku' => 'LEG-' . strtoupper(uniqid()),
            'base_price' => 12.00,
            'width_mm' => 85.0,
            'height_mm' => 55.0,
            'margin_mm' => 2.0,
            'bleed_mm' => 3.0,
            'safe_area_mm' => 3.0,
            'is_active' => true,
        ]);

        // Legacy template created without print_sides, back_canvas_json, or custom mm
        $legacyTemplate = DesignTemplate::create([
            'product_id' => $product->id,
            'name' => 'Legacy 2024 Template',
            'category' => 'General',
            'canvas_json' => ['version' => '5.3.0', 'objects' => []],
            'is_active' => true,
        ]);

        $response = $this->getJson("/api/v1/designer/templates/{$product->id}/{$legacyTemplate->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $legacyTemplate->id,
                    'name' => 'Legacy 2024 Template',
                ],
            ]);

        $data = $response->json('data');
        $resolved = $data['resolved_print_settings'];

        // Fallback priority: product values should resolve when template values are null
        $this->assertEquals('front', $resolved['print_sides']);
        $this->assertEquals(85.0, $resolved['width_mm']);
        $this->assertEquals(55.0, $resolved['height_mm']);
        $this->assertEquals(3.0, $resolved['bleed_mm']);
    }

    /**
     * Test 7: Public customer API returning resolved template/product settings.
     */
    public function test_public_customer_api_returns_resolved_settings(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Custom Mug Product',
            'slug' => 'custom-mug-' . uniqid(),
            'sku' => 'MUG-' . strtoupper(uniqid()),
            'base_price' => 15.00,
            'print_sides' => 'front',
            'width_mm' => 200.0,
            'height_mm' => 95.0,
            'is_active' => true,
        ]);

        // Template overrides height_mm specifically
        $template = DesignTemplate::create([
            'product_id' => $product->id,
            'name' => 'Panoramic Mug Wrap',
            'category' => 'Gifts',
            'height_mm' => 90.0, // overrides product 95.0
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);

        $response = $this->getJson("/api/v1/designer/templates/{$product->id}/{$template->id}");

        $response->assertStatus(200);
        $resolved = $response->json('data.resolved_print_settings');

        $this->assertEquals('front', $resolved['print_sides']);
        $this->assertEquals(200.0, $resolved['width_mm']); // from product
        $this->assertEquals(90.0, $resolved['height_mm']);  // overridden by template
    }

    /**
     * Test 8: Front and back switching data integrity (both canvases stored independently).
     */
    public function test_front_and_back_canvases_stored_independently(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Dual Postcard Product',
            'slug' => 'dual-postcard-' . uniqid(),
            'sku' => 'DPC-' . strtoupper(uniqid()),
            'base_price' => 18.00,
            'is_active' => true,
        ]);

        $template = DesignTemplate::create([
            'product_id' => $product->id,
            'name' => 'Dual Postcard Template',
            'print_sides' => 'both',
            'canvas_json' => ['side' => 'front', 'version' => '6.0.0'],
            'back_canvas_json' => ['side' => 'back', 'version' => '6.0.0'],
            'is_active' => true,
        ]);

        // Update ONLY back canvas
        $this->actingAs($this->adminUser, 'sanctum')
            ->putJson("/api/v1/admin/design-templates/{$template->id}", [
                'back_canvas_json' => ['side' => 'back', 'updated' => true],
            ])
            ->assertStatus(200);

        $template->refresh();
        // Front canvas must NOT be wiped
        $this->assertEquals('front', $template->canvas_json['side']);
        $this->assertTrue($template->back_canvas_json['updated']);
    }
}
