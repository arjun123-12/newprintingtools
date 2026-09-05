<?php

namespace Tests\Feature;

use App\Models\Artwork;
use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CustomerArtworkWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected User $customerA;
    protected User $customerB;
    protected Product $product;
    protected DesignTemplate $template;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customerA = User::create([
            'name' => 'Customer A',
            'email' => 'customer_a_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);

        $this->customerB = User::create([
            'name' => 'Customer B',
            'email' => 'customer_b_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);

        $category = Category::first() ?? Category::create([
            'name' => 'Cards',
            'slug' => 'cards-' . uniqid(),
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $category->id,
            'name' => 'Custom Business Card',
            'slug' => 'custom-card-' . uniqid(),
            'sku' => 'CC-' . uniqid(),
            'base_price' => 25.00,
            'is_active' => true,
        ]);

        $this->template = DesignTemplate::create([
            'product_id' => $this->product->id,
            'name' => 'Master Template',
            'category' => 'Corporate',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [
                    [
                        'type' => 'textbox',
                        'text' => 'Default Company Name',
                        'left' => 100,
                        'top' => 50,
                    ],
                ],
            ],
            'thumbnail_url' => 'http://127.0.0.1:8000/api/v1/storage/designer/master_thumb.png',
            'is_active' => true,
        ]);
    }

    /**
     * Test saving customer artwork creates an artworks row and does not touch master template.
     */
    public function test_customer_saves_artwork_without_mutating_master_template(): void
    {
        $originalTemplateJson = $this->template->canvas_json;
        $originalTemplateUpdatedAt = $this->template->updated_at;

        $customerEditedJson = [
            'version' => '6.0.0',
            'objects' => [
                [
                    'type' => 'textbox',
                    'text' => 'Acme Corporation - John Doe',
                    'left' => 120,
                    'top' => 60,
                ],
                [
                    'type' => 'image',
                    'src' => 'http://127.0.0.1:8000/api/v1/storage/designer/acme_logo.png',
                    'left' => 50,
                    'top' => 50,
                ],
            ],
        ];

        $payload = [
            'product_id' => $this->product->id,
            'template_id' => $this->template->id,
            'name' => 'My Personal Card Design',
            'canvas_json' => $customerEditedJson,
            'thumbnail_url' => 'http://127.0.0.1:8000/api/v1/storage/designer/customer_thumb.png',
        ];

        $response = $this->actingAs($this->customerA)
            ->postJson('/api/v1/artworks', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Artwork saved successfully.',
            ]);

        $artworkId = $response->json('data.id');
        $this->assertNotNull($artworkId);

        // Verify the customer artwork row
        $artwork = Artwork::findOrFail($artworkId);
        $this->assertEquals($this->customerA->id, $artwork->user_id);
        $this->assertEquals($this->template->id, $artwork->template_id);
        $this->assertEquals($this->product->id, $artwork->product_id);
        $this->assertEquals('My Personal Card Design', $artwork->name);
        $this->assertEquals($customerEditedJson, $artwork->canvas_json);

        // CRITICAL CHECK: Master template must be UNCHANGED
        $freshTemplate = $this->template->fresh();
        $this->assertEquals($originalTemplateJson, $freshTemplate->canvas_json);
        $this->assertEquals($originalTemplateUpdatedAt->toDateTimeString(), $freshTemplate->updated_at->toDateTimeString());
    }

    /**
     * Test reopening customer artwork restores complete design.
     */
    public function test_customer_can_reopen_and_update_saved_artwork(): void
    {
        $artwork = Artwork::create([
            'user_id' => $this->customerA->id,
            'product_id' => $this->product->id,
            'template_id' => $this->template->id,
            'name' => 'Customer Design 1',
            'source_type' => 'designer',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [['type' => 'textbox', 'text' => 'First Edit']],
            ],
        ]);

        // Customer A can reopen
        $showResponse = $this->actingAs($this->customerA)
            ->getJson('/api/v1/artworks/' . $artwork->id);

        $showResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $artwork->id,
                    'name' => 'Customer Design 1',
                ],
            ]);

        // Customer A can update
        $updatePayload = [
            'name' => 'Customer Design 1 - Updated',
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [['type' => 'textbox', 'text' => 'Second Edit']],
            ],
        ];

        $updateResponse = $this->actingAs($this->customerA)
            ->putJson('/api/v1/artworks/' . $artwork->id, $updatePayload);

        $updateResponse->assertStatus(200);

        $freshArtwork = $artwork->fresh();
        $this->assertEquals('Customer Design 1 - Updated', $freshArtwork->name);
        $this->assertEquals('Second Edit', $freshArtwork->canvas_json['objects'][0]['text']);
    }

    /**
     * Test access control: Customer B cannot access or update Customer A's artwork.
     */
    public function test_another_customer_cannot_access_or_update_artwork(): void
    {
        $artwork = Artwork::create([
            'user_id' => $this->customerA->id,
            'product_id' => $this->product->id,
            'template_id' => $this->template->id,
            'name' => 'Customer A Private Design',
            'source_type' => 'designer',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
        ]);

        // Customer B tries to view -> 403 Forbidden
        $showResponse = $this->actingAs($this->customerB)
            ->getJson('/api/v1/artworks/' . $artwork->id);
        $showResponse->assertStatus(403);

        // Customer B tries to update -> 403 Forbidden
        $updateResponse = $this->actingAs($this->customerB)
            ->putJson('/api/v1/artworks/' . $artwork->id, [
                'name' => 'Hacked Name',
            ]);
        $updateResponse->assertStatus(403);

        // Verify name was not modified
        $this->assertEquals('Customer A Private Design', $artwork->fresh()->name);
    }

    /**
     * Test guest session artwork isolation.
     */
    public function test_guest_session_artwork_isolated(): void
    {
        $guestSession1 = 'session-token-123';
        $guestSession2 = 'session-token-456';

        $payload = [
            'product_id' => $this->product->id,
            'template_id' => $this->template->id,
            'session_id' => $guestSession1,
            'name' => 'Guest Design 1',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
        ];

        $createResponse = $this->postJson('/api/v1/artworks', $payload);
        $createResponse->assertStatus(201);
        $artworkId = $createResponse->json('data.id');

        // Session 1 can read
        $this->withHeader('X-Session-ID', $guestSession1)
            ->getJson('/api/v1/artworks/' . $artworkId)
            ->assertStatus(200);

        // Session 2 is forbidden
        $this->withHeader('X-Session-ID', $guestSession2)
            ->getJson('/api/v1/artworks/' . $artworkId)
            ->assertStatus(403);
    }
}
