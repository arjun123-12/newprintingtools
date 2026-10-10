<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class StandaloneDesignerFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $category;
    protected Product $realProduct;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Standalone Tester',
            'email' => 'admin_standalone_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->category = Category::first() ?? Category::create([
            'name' => 'Marketing Materials',
            'slug' => 'marketing-' . uniqid(),
            'is_active' => true,
        ]);

        $this->realProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Real Business Card',
            'slug' => 'real-card-' . uniqid(),
            'sku' => 'CARD-' . uniqid(),
            'base_price' => 45.00,
            'is_active' => true,
            'width_mm' => 90.00,
            'height_mm' => 50.00,
            'bleed_mm' => 3.00,
            'safe_area_mm' => 3.00,
            'margin_mm' => 3.00,
            'print_sides' => 'both',
        ]);
    }

    /**
     * Verify that GET /api/v1/products/default returns 404
     * confirming that no dummy product named 'default' was created.
     */
    public function test_get_products_default_returns_not_found_without_dummy_product(): void
    {
        $response = $this->getJson('/api/v1/products/default');
        $response->assertStatus(404);
    }

    /**
     * Verify that real products continue to return 200 with full data.
     */
    public function test_get_real_product_returns_product_configuration(): void
    {
        $response = $this->getJson('/api/v1/products/' . $this->realProduct->id);
        $response->assertStatus(200)
            ->assertJsonPath('data.id', $this->realProduct->id)
            ->assertJsonPath('data.name', 'Real Business Card')
            ->assertJsonPath('data.print_sides', 'both');
    }

    /**
     * Verify standalone template saving with null / absent product_id.
     */
    public function test_standalone_template_saves_with_nullable_product_id(): void
    {
        $canvasJson = [
            'version' => '6.0.0',
            'objects' => [
                ['type' => 'textbox', 'text' => 'Standalone Artwork Template']
            ],
            'background' => '#ffffff',
        ];

        $payload = [
            'name' => 'Standalone Studio Template ' . uniqid(),
            'product_id' => null,
            'width_mm' => 90,
            'height_mm' => 50,
            'print_sides' => 'front',
            'canvas_json' => $canvasJson,
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.product_id', null)
            ->assertJsonPath('data.name', $payload['name']);

        $templateId = $response->json('data.id');
        $this->assertDatabaseHas('design_templates', [
            'id' => $templateId,
            'product_id' => null,
        ]);
    }

    /**
     * Verify real product template saving preserves product_id relationship.
     */
    public function test_real_product_template_preserves_product_id(): void
    {
        $canvasJson = [
            'version' => '6.0.0',
            'objects' => [
                ['type' => 'textbox', 'text' => 'Connected Product Template']
            ],
            'background' => '#ffffff',
        ];

        $payload = [
            'name' => 'Connected Template ' . uniqid(),
            'product_id' => $this->realProduct->id,
            'width_mm' => 90,
            'height_mm' => 50,
            'print_sides' => 'both',
            'canvas_json' => $canvasJson,
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.product_id', $this->realProduct->id);

        $templateId = $response->json('data.id');
        $this->assertDatabaseHas('design_templates', [
            'id' => $templateId,
            'product_id' => $this->realProduct->id,
        ]);
    }
}
