<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PricingMatrix;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductSide;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductPermanentDeletionTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Product Deletion Tester',
            'email' => 'admin_del_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Product Deletion Tester',
            'email' => 'cust_del_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'customer',
        ]);

        $this->category = Category::create([
            'name' => 'Category For Deletion Test ' . uniqid(),
            'slug' => 'cat-del-test-' . uniqid(),
            'is_active' => true,
        ]);
    }

    /**
     * 1. Product deletion removes the database record permanently, cascades owned records,
     * and keeps category and other products intact.
     */
    public function test_authorized_admin_can_permanently_delete_product(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Permanent Delete Product ' . uniqid(),
            'slug' => 'perm-del-' . uniqid(),
            'sku' => 'SKU-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 25.00,
            'is_active' => true,
        ]);

        $otherProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Other Unaffected Product ' . uniqid(),
            'slug' => 'other-unaffected-' . uniqid(),
            'sku' => 'SKU-OTH-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 30.00,
            'is_active' => true,
        ]);

        // Add owned records: attribute, pricing matrix, side, variant
        $attr = ProductAttribute::create([
            'product_id' => $product->id,
            'name' => 'Paper Weight',
            'code' => 'paper_weight',
            'type' => 'select',
            'sort_order' => 1,
        ]);
        ProductAttributeValue::create([
            'product_attribute_id' => $attr->id,
            'label' => '350gsm Silk',
            'value' => '350gsm',
            'price_modifier' => 0.00,
            'sort_order' => 1,
        ]);

        $pricing = PricingMatrix::create([
            'product_id' => $product->id,
            'quantity' => 100,
            'unit_price_ex_gst' => 0.25,
            'setup_fee' => 0.00,
            'discount_percentage' => 0.00,
        ]);

        $side = ProductSide::create([
            'product_id' => $product->id,
            'side_number' => 1,
            'name' => 'Front Side',
            'type' => 'front',
            'sort_order' => 1,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'VAR-' . uniqid(),
            'price' => 25.00,
            'sort_order' => 1,
        ]);

        // Call the permanent delete endpoint
        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/products/{$product->id}");

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'message' => 'Product permanently deleted successfully.',
        ]);

        // Verify product record is permanently deleted from database (not just soft-deleted)
        $this->assertDatabaseMissing('products', ['id' => $product->id]);

        // Verify owned child records are deleted
        $this->assertDatabaseMissing('product_attributes', ['id' => $attr->id]);
        $this->assertDatabaseMissing('pricing_matrices', ['id' => $pricing->id]);
        $this->assertDatabaseMissing('product_sides', ['id' => $side->id]);
        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);

        // Verify category is NOT deleted
        $this->assertDatabaseHas('categories', ['id' => $this->category->id]);

        // Verify other product remains intact
        $this->assertDatabaseHas('products', ['id' => $otherProduct->id]);
    }

    /**
     * 2. Product deletion is prevented when customer orders reference the product.
     */
    public function test_product_deletion_blocked_when_product_has_customer_orders(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Ordered Product ' . uniqid(),
            'slug' => 'ordered-prod-' . uniqid(),
            'sku' => 'SKU-ORD-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 45.00,
            'is_active' => true,
        ]);

        $order = Order::create([
            'user_id' => $this->customerUser->id,
            'order_number' => 'ORD-' . strtoupper(uniqid()),
            'status' => 'pending_payment',
            'subtotal_ex_gst' => 45.00,
            'gst_amount' => 4.50,
            'total_inc_gst' => 49.50,
            'currency' => 'AUD',
            'shipping_address' => ['line1' => '123 Test St'],
            'billing_address' => ['line1' => '123 Test St'],
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'product_sku' => $product->sku,
            'quantity' => 1,
            'unit_price_ex_gst' => 45.00,
            'unit_price_inc_gst' => 49.50,
            'total_price_inc_gst' => 49.50,
            'options_snapshot' => [],
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/v1/admin/products/{$product->id}");

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
        $response->assertJsonFragment([
            'message' => 'Cannot permanently delete product because it is associated with existing customer orders. You may archive it instead.',
        ]);

        // Product must still exist in the database
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    /**
     * 3. Unauthorized users cannot delete products.
     */
    public function test_unauthorized_user_cannot_delete_product(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Protected Product ' . uniqid(),
            'slug' => 'prot-prod-' . uniqid(),
            'sku' => 'SKU-PROT-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 20.00,
            'is_active' => true,
        ]);

        // Unauthenticated guest
        $guestResponse = $this->deleteJson("/api/v1/admin/products/{$product->id}");
        $guestResponse->assertStatus(401);

        // Authenticated customer (non-admin)
        $customerResponse = $this->actingAs($this->customerUser)
            ->deleteJson("/api/v1/admin/products/{$product->id}");
        $customerResponse->assertStatus(403);

        // Product still exists
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    /**
     * 4. Soft-delete (archive) and restore functionality remains intact.
     */
    public function test_product_can_be_archived_and_restored_without_breaking(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Archive Product ' . uniqid(),
            'slug' => 'arch-prod-' . uniqid(),
            'sku' => 'SKU-ARCH-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 15.00,
            'is_active' => true,
        ]);

        // Archive via dedicated archive endpoint
        $archiveResponse = $this->actingAs($this->adminUser)
            ->postJson("/api/v1/admin/products/{$product->id}/archive");

        $archiveResponse->assertOk();
        $archiveResponse->assertJson([
            'success' => true,
            'message' => 'Product moved to archive successfully.',
        ]);

        $this->assertSoftDeleted('products', ['id' => $product->id]);

        // Restore
        $restoreResponse = $this->actingAs($this->adminUser)
            ->postJson("/api/v1/admin/products/{$product->id}/restore");

        $restoreResponse->assertOk();
        $restoreResponse->assertJson([
            'success' => true,
            'message' => 'Product restored successfully.',
        ]);

        $this->assertNotSoftDeleted('products', ['id' => $product->id]);
    }

    /**
     * 5. Bulk permanent delete permanently deletes multiple products.
     */
    public function test_admin_can_bulk_permanently_delete_products(): void
    {
        $p1 = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Bulk P1 ' . uniqid(),
            'slug' => 'bulk-p1-' . uniqid(),
            'sku' => 'SKU-BP1-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 10.00,
            'is_active' => true,
        ]);

        $p2 = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Bulk P2 ' . uniqid(),
            'slug' => 'bulk-p2-' . uniqid(),
            'sku' => 'SKU-BP2-' . uniqid(),
            'product_type' => 'standard_print',
            'base_price' => 12.00,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/admin/products/bulk-delete', [
                'ids' => [$p1->id, $p2->id],
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'deleted_count' => 2,
        ]);

        $this->assertDatabaseMissing('products', ['id' => $p1->id]);
        $this->assertDatabaseMissing('products', ['id' => $p2->id]);
    }
}
