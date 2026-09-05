<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminTemplateWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->adminUser = User::create([
            'name' => 'Admin User',
            'email' => 'admin_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $category = Category::first() ?? Category::create([
            'name' => 'Business Cards',
            'slug' => 'business-cards-' . uniqid(),
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $category->id,
            'name' => 'Premium Business Card',
            'slug' => 'premium-card-' . uniqid(),
            'sku' => 'CARD-' . uniqid(),
            'base_price' => 19.99,
            'is_active' => true,
        ]);
    }

    /**
     * Test admin creates a master template with valid canvas JSON.
     */
    public function test_admin_can_create_template_with_valid_json(): void
    {
        $payload = [
            'product_id' => $this->product->id,
            'name' => 'Modern Minimalist Template',
            'category' => 'Corporate',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [
                    [
                        'type' => 'textbox',
                        'text' => 'John Doe',
                        'left' => 100,
                        'top' => 100,
                        'fontSize' => 24,
                        'fill' => '#111827',
                    ],
                    [
                        'type' => 'image',
                        'src' => 'http://127.0.0.1:8000/api/v1/storage/designer/logo.png',
                        'originalSrc' => 'http://127.0.0.1:8000/api/v1/storage/designer/logo.png',
                        'left' => 50,
                        'top' => 50,
                    ],
                ],
            ],
            'thumbnail_url' => 'http://127.0.0.1:8000/api/v1/storage/designer/thumb.png',
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $templateId = $response->json('data.id');
        $this->assertNotNull($templateId);

        $template = DesignTemplate::findOrFail($templateId);
        $this->assertEquals($this->product->id, $template->product_id);
        $this->assertIsArray($template->canvas_json);
        $this->assertCount(2, $template->canvas_json['objects']);
        $this->assertTrue($template->is_active);
    }

    /**
     * Test admin template persists and returns dynamic artwork configuration and template_json.
     */
    public function test_admin_template_persists_and_returns_artwork_config_and_template_json(): void
    {
        $payload = [
            'product_id' => $this->product->id,
            'name' => 'A4 Dynamic Poster Template',
            'category' => 'Posters',
            'artwork_config' => [
                'width' => 210,
                'height' => 297,
                'unit' => 'mm',
                'bleed' => 5,
                'safe_area' => 5,
                'margin' => 3,
                'trim' => true,
                'dpi' => 300,
                'orientation' => 'portrait',
                'print_area' => ['width' => 2480, 'height' => 3508],
                'guides' => [
                    'showBleed' => true,
                    'showSafeZone' => true,
                    'showTrim' => true,
                ],
            ],
            'template_json' => [
                'version' => '6.0.0',
                'objects' => [
                    [
                        'type' => 'textbox',
                        'text' => 'Grand Opening',
                        'left' => 200,
                        'top' => 300,
                    ],
                ],
            ],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'A4 Dynamic Poster Template',
                    'artwork_config' => [
                        'width' => 210,
                        'height' => 297,
                        'bleed' => 5,
                        'safe_area' => 5,
                        'margin' => 3,
                        'dpi' => 300,
                    ],
                ],
            ]);

        $templateId = $response->json('data.id');

        // Verify fetching the template returns artwork_config and template_json
        $fetchResponse = $this->getJson("/api/v1/designer/templates/{$this->product->id}/{$templateId}");
        $fetchResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $templateId,
                    'artwork_config' => [
                        'width' => 210,
                        'height' => 297,
                        'bleed' => 5,
                        'safe_area' => 5,
                        'margin' => 3,
                        'dpi' => 300,
                    ],
                ],
            ]);
        $this->assertNotEmpty($fetchResponse->json('data.template_json'));
    }

    /**
     * Test rejecting embedded base64 or blob images in canvas_json.
     */
    public function test_admin_template_rejects_embedded_base64_images(): void
    {
        $payload = [
            'product_id' => $this->product->id,
            'name' => 'Invalid Base64 Template',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [
                    [
                        'type' => 'image',
                        'src' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    ],
                ],
            ],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/templates', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['canvas_json']);
    }

    /**
     * Test active template appears for the correct customer product, but not inactive.
     */
    public function test_customer_only_sees_active_templates_for_product(): void
    {
        $activeTemplate = DesignTemplate::create([
            'product_id' => $this->product->id,
            'name' => 'Active Template',
            'category' => 'Corporate',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);

        $inactiveTemplate = DesignTemplate::create([
            'product_id' => $this->product->id,
            'name' => 'Inactive Template',
            'category' => 'Corporate',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => false,
        ]);

        $otherProduct = Product::create([
            'category_id' => $this->product->category_id,
            'name' => 'Brochure',
            'slug' => 'brochure-' . uniqid(),
            'sku' => 'BRO-' . uniqid(),
            'base_price' => 29.99,
            'is_active' => true,
        ]);

        $otherTemplate = DesignTemplate::create([
            'product_id' => $otherProduct->id,
            'name' => 'Other Product Template',
            'category' => 'Marketing',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);

        // Query templates for $this->product
        $response = $this->getJson('/api/v1/designer/templates/' . $this->product->id);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $templateIds = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($activeTemplate->id, $templateIds);
        $this->assertNotContains($inactiveTemplate->id, $templateIds);
        $this->assertNotContains($otherTemplate->id, $templateIds);
    }

    /**
     * Test CORS-safe storage serving.
     */
    public function test_storage_endpoint_serves_file_with_cors_headers(): void
    {
        Storage::disk('public')->put('designer/test.png', 'fake image content');

        $response = $this->get('/api/v1/storage/designer/test.png');

        $response->assertStatus(200)
            ->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    /**
     * Test storage endpoint prevents directory traversal attacks.
     */
    public function test_storage_endpoint_prevents_directory_traversal(): void
    {
        $response = $this->get('/api/v1/storage/../.env');
        $response->assertStatus(403);
    }
}
