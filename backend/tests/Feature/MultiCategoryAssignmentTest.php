<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class MultiCategoryAssignmentTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected Category $cat1;
    protected Category $cat2;
    protected Category $cat3;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Tester',
            'email' => 'admin_multi_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->cat1 = Category::create([
            'name' => 'Business Cards ' . uniqid(),
            'slug' => 'biz-cards-' . uniqid(),
            'is_active' => true,
        ]);

        $this->cat2 = Category::create([
            'name' => 'Marketing Materials ' . uniqid(),
            'slug' => 'marketing-' . uniqid(),
            'is_active' => true,
        ]);

        $this->cat3 = Category::create([
            'name' => 'Stationery ' . uniqid(),
            'slug' => 'stationery-' . uniqid(),
            'is_active' => true,
        ]);
    }

    public function test_admin_can_create_product_with_multiple_categories(): void
    {
        $payload = [
            'name' => 'Multi Category Silk Card',
            'slug' => 'multi-cat-silk-card-' . uniqid(),
            'sku' => 'MC-SILK-' . uniqid(),
            'category_ids' => [$this->cat1->id, $this->cat2->id, $this->cat1->id], // contains duplicate to test deduplication
            'product_type' => 'standard_print',
            'min_quantity' => 100,
            'turnaround_days' => 3,
            'base_price' => 45.00,
        ];

        $res = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/products', $payload);

        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $productId = $res->json('data.id');
        $product = Product::with('categories')->findOrFail($productId);

        // Verify primary category_id is set
        $this->assertEquals($this->cat1->id, $product->category_id);

        // Verify categories relation has exactly 2 unique categories (cat1 and cat2)
        $assignedIds = $product->categories->pluck('id')->all();
        $this->assertCount(2, $assignedIds);
        $this->assertContains($this->cat1->id, $assignedIds);
        $this->assertContains($this->cat2->id, $assignedIds);

        // Verify response payload has category_ids array
        $this->assertEqualsCanonicalizing([$this->cat1->id, $this->cat2->id], $res->json('data.category_ids'));
    }

    public function test_admin_can_update_product_categories_add_and_remove(): void
    {
        $product = Product::create([
            'name' => 'Test Product',
            'slug' => 'test-prod-' . uniqid(),
            'sku' => 'TP-' . uniqid(),
            'category_id' => $this->cat1->id,
            'product_type' => 'standard_print',
            'base_price' => 20.00,
        ]);
        $product->categories()->sync([$this->cat1->id, $this->cat2->id]);

        // Now update: remove cat2, add cat3
        $updatePayload = [
            'category_ids' => [$this->cat1->id, $this->cat3->id],
        ];

        $res = $this->actingAs($this->adminUser)
            ->patchJson("/api/v1/admin/products/{$product->id}", $updatePayload);

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $product->refresh();
        $assignedIds = $product->categories->pluck('id')->all();

        $this->assertCount(2, $assignedIds);
        $this->assertContains($this->cat1->id, $assignedIds);
        $this->assertContains($this->cat3->id, $assignedIds);
        $this->assertNotContains($this->cat2->id, $assignedIds);
    }

    public function test_admin_can_create_template_with_multiple_categories(): void
    {
        $payload = [
            'name' => 'Multi Category Template',
            'category_ids' => [$this->cat2->id, $this->cat3->id, $this->cat2->id], // duplicate test
            'canvas_json' => [
                'version' => '6.0.0',
                'objects' => [],
            ],
            'is_active' => true,
        ];

        $res = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/design-templates', $payload);

        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $templateId = $res->json('data.id');
        $template = DesignTemplate::with('categories')->findOrFail($templateId);

        $assignedIds = $template->categories->pluck('id')->all();
        $this->assertCount(2, $assignedIds);
        $this->assertContains($this->cat2->id, $assignedIds);
        $this->assertContains($this->cat3->id, $assignedIds);
    }

    public function test_admin_can_update_template_categories(): void
    {
        $template = DesignTemplate::create([
            'name' => 'Initial Template',
            'category' => $this->cat1->name,
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);
        $template->categories()->sync([$this->cat1->id]);

        $updatePayload = [
            'category_ids' => [$this->cat2->id, $this->cat3->id],
        ];

        $res = $this->actingAs($this->adminUser)
            ->putJson("/api/v1/admin/design-templates/{$template->id}", $updatePayload);

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $template->refresh();
        $assignedIds = $template->categories->pluck('id')->all();

        $this->assertCount(2, $assignedIds);
        $this->assertContains($this->cat2->id, $assignedIds);
        $this->assertContains($this->cat3->id, $assignedIds);
        $this->assertNotContains($this->cat1->id, $assignedIds);
    }

    public function test_category_deletion_blocked_when_product_or_template_assigned(): void
    {
        // 1. Assign product to cat2 via pivot only
        $product = Product::create([
            'name' => 'Pivot Product',
            'slug' => 'pivot-prod-' . uniqid(),
            'sku' => 'PP-' . uniqid(),
            'category_id' => $this->cat1->id, // primary is cat1
            'product_type' => 'standard_print',
            'base_price' => 10.00,
        ]);
        $product->categories()->sync([$this->cat1->id, $this->cat2->id]);

        // Attempt to delete cat2
        $res = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$this->cat2->id}");

        $res->assertStatus(422)
            ->assertJsonPath('success', false);

        // Remove product link to cat2
        $product->categories()->sync([$this->cat1->id]);

        // 2. Assign template to cat2 via pivot
        $template = DesignTemplate::create([
            'name' => 'Pivot Template',
            'category' => 'Marketing',
            'canvas_json' => ['version' => '6.0.0', 'objects' => []],
            'is_active' => true,
        ]);
        $template->categories()->sync([$this->cat2->id]);

        // Attempt to delete cat2
        $res2 = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$this->cat2->id}");

        $res2->assertStatus(422)
            ->assertJsonPath('success', false);

        // Remove template link to cat2
        $template->categories()->detach($this->cat2->id);

        // Now cat2 is eligible for deletion
        $res3 = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$this->cat2->id}");

        $res3->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_admin_can_create_category_with_auto_slug_for_quick_assignment(): void
    {
        $uniqueName = 'Hospitality ' . uniqid();
        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/categories', [
                'name' => $uniqueName,
                'is_active' => true,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', $uniqueName);

        $createdSlug = $response->json('data.slug');
        $this->assertNotEmpty($createdSlug);
        $this->assertDatabaseHas('categories', [
            'name' => $uniqueName,
            'slug' => $createdSlug,
        ]);
    }
}
