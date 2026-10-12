<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CategoryDeletionTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Category Deletion Tester',
            'email' => 'admin_cat_del_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Category Deletion Tester',
            'email' => 'cust_cat_del_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'customer',
        ]);
    }

    /**
     * 1. Eligible category (no products, no children) can be permanently deleted.
     */
    public function test_authorized_admin_can_permanently_delete_eligible_category(): void
    {
        $category = Category::create([
            'name' => 'Eligible Category ' . uniqid(),
            'slug' => 'eligible-cat-' . uniqid(),
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$category->id}");

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'message' => 'Category permanently deleted successfully.',
        ]);

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    /**
     * 2. Category deletion is blocked when products exist in that category.
     */
    public function test_category_deletion_blocked_when_products_exist_in_category(): void
    {
        $category = Category::create([
            'name' => 'Category With Products ' . uniqid(),
            'slug' => 'cat-with-prods-' . uniqid(),
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Blocking Product ' . uniqid(),
            'slug' => 'blocking-prod-' . uniqid(),
            'sku' => 'SKU-BLK-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 10.00,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$category->id}");

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
        $response->assertJsonFragment([
            'message' => "Cannot delete category '{$category->name}' because 1 product(s) are assigned to it. Please move or delete those products first.",
        ]);

        // Category must still exist
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    /**
     * 3. Category deletion is blocked when child subcategories exist under it.
     */
    public function test_category_deletion_blocked_when_child_subcategories_exist(): void
    {
        $parentCategory = Category::create([
            'name' => 'Parent Category ' . uniqid(),
            'slug' => 'parent-cat-' . uniqid(),
            'is_active' => true,
        ]);

        $childCategory = Category::create([
            'parent_id' => $parentCategory->id,
            'name' => 'Child Category ' . uniqid(),
            'slug' => 'child-cat-' . uniqid(),
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/categories/{$parentCategory->id}");

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
        $response->assertJsonFragment([
            'message' => "Cannot delete category '{$parentCategory->name}' because 1 subcategory(ies) exist under it. Please reassign or delete the subcategories first.",
        ]);

        // Parent category must still exist
        $this->assertDatabaseHas('categories', ['id' => $parentCategory->id]);
        $this->assertDatabaseHas('categories', ['id' => $childCategory->id]);
    }

    /**
     * 4. Unauthorized users cannot delete categories.
     */
    public function test_unauthorized_users_cannot_delete_category(): void
    {
        $category = Category::create([
            'name' => 'Protected Category ' . uniqid(),
            'slug' => 'prot-cat-' . uniqid(),
            'is_active' => true,
        ]);

        // Guest
        $guestResponse = $this->deleteJson("/api/v1/admin/categories/{$category->id}");
        $guestResponse->assertStatus(401);

        // Customer
        $customerResponse = $this->actingAs($this->customerUser)
            ->deleteJson("/api/v1/admin/categories/{$category->id}");
        $customerResponse->assertStatus(403);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    /**
     * 5. Category can still be archived and restored.
     */
    public function test_category_can_be_archived_and_restored(): void
    {
        $category = Category::create([
            'name' => 'Archive Category ' . uniqid(),
            'slug' => 'arch-cat-' . uniqid(),
            'is_active' => true,
        ]);

        // Archive
        $archiveResponse = $this->actingAs($this->adminUser)
            ->postJson("/api/v1/admin/categories/{$category->id}/archive");

        $archiveResponse->assertOk();
        $archiveResponse->assertJson([
            'success' => true,
            'message' => 'Category moved to archive successfully.',
        ]);

        $this->assertSoftDeleted('categories', ['id' => $category->id]);

        // Restore
        $restoreResponse = $this->actingAs($this->adminUser)
            ->postJson("/api/v1/admin/categories/{$category->id}/restore");

        $restoreResponse->assertOk();
        $restoreResponse->assertJson([
            'success' => true,
            'message' => 'Category restored successfully.',
        ]);

        $this->assertNotSoftDeleted('categories', ['id' => $category->id]);
    }

    /**
     * 6. Bulk permanent delete of eligible categories.
     */
    public function test_admin_can_bulk_permanently_delete_eligible_categories(): void
    {
        $c1 = Category::create([
            'name' => 'Bulk Eligible 1 ' . uniqid(),
            'slug' => 'bulk-elig-1-' . uniqid(),
            'is_active' => true,
        ]);

        $c2 = Category::create([
            'name' => 'Bulk Eligible 2 ' . uniqid(),
            'slug' => 'bulk-elig-2-' . uniqid(),
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/categories/bulk-delete', [
                'ids' => [$c1->id, $c2->id],
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'deleted_count' => 2,
        ]);

        $this->assertDatabaseMissing('categories', ['id' => $c1->id]);
        $this->assertDatabaseMissing('categories', ['id' => $c2->id]);
    }
}
