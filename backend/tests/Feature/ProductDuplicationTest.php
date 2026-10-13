<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\PricingMatrix;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductPrintArea;
use App\Models\ProductSide;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductDuplicationTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Product Copy Tester',
            'email' => 'admin_copy_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Copy Tester',
            'email' => 'cust_copy_' . uniqid() . '@example.com',
            'password' => bcrypt('secret123'),
            'role' => 'customer',
        ]);

        $this->category = Category::create([
            'name' => 'Category For Copy Test ' . uniqid(),
            'slug' => 'cat-copy-test-' . uniqid(),
            'is_active' => true,
        ]);
    }

    public function test_admin_can_duplicate_product_with_all_configurations(): void
    {
        // 1. Create a full source product
        $sourceProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Original Business Card ' . uniqid(),
            'slug' => 'original-card-' . uniqid(),
            'sku' => 'CARD-ORIG-' . rand(1000, 9999),
            'base_price' => 25.50,
            'status' => 'published',
            'is_active' => true,
            'description' => 'Original card description',
        ]);

        // Add side and print area
        $side = ProductSide::create([
            'product_id' => $sourceProduct->id,
            'name' => 'Front Side',
            'side_number' => 1,
            'type' => 'front',
            'sort_order' => 1,
        ]);

        $printArea = ProductPrintArea::create([
            'product_id' => $sourceProduct->id,
            'product_side_id' => $side->id,
            'name' => 'Full Bleed Front',
            'width_mm' => 90,
            'height_mm' => 54,
            'bleed_mm' => 2.00,
            'safe_zone_mm' => 3.00,
        ]);

        // Add attribute and values
        $attr = ProductAttribute::create([
            'product_id' => $sourceProduct->id,
            'name' => 'Paper Stock',
            'code' => 'paper_stock',
            'type' => 'select',
            'is_required' => true,
        ]);

        $attrVal = ProductAttributeValue::create([
            'product_attribute_id' => $attr->id,
            'label' => '350gsm Silk',
            'value' => '350gsm_silk',
            'price_modifier_type' => 'fixed',
            'price_modifier_amount' => 5.00,
        ]);

        // Add pricing matrix tier
        $matrix = PricingMatrix::create([
            'product_id' => $sourceProduct->id,
            'quantity' => 500,
            'unit_price_ex_gst' => 0.11,
            'setup_fee' => 0.00,
        ]);

        // Add shipping row
        DB::table('product_shippings')->insert([
            'product_id' => $sourceProduct->id,
            'weight' => 1.25,
            'length' => 20,
            'width' => 15,
            'height' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Perform duplicate request as admin
        $response = $this->actingAs($this->adminUser, 'sanctum')
            ->postJson("/api/v1/admin/products/{$sourceProduct->id}/duplicate");

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $newProductId = $response->json('data.id');
        $this->assertNotEmpty($newProductId);
        $this->assertNotEquals($sourceProduct->id, $newProductId);

        // 3. Verify duplicated product in database
        $duplicated = Product::with(['sides.printAreas', 'attributes.values', 'pricingMatrices'])->find($newProductId);
        $this->assertNotNull($duplicated);
        $this->assertEquals($sourceProduct->name . ' (Copy)', $duplicated->name);
        $this->assertNotEquals($sourceProduct->slug, $duplicated->slug);
        $this->assertNotEquals($sourceProduct->sku, $duplicated->sku);
        $this->assertEquals('draft', $duplicated->status);
        $this->assertEquals($sourceProduct->base_price, $duplicated->base_price);

        // Verify side & print area duplicated
        $this->assertCount(1, $duplicated->sides);
        $this->assertEquals('Front Side', $duplicated->sides[0]->name);
        $this->assertCount(1, $duplicated->sides[0]->printAreas);
        $this->assertEquals('Full Bleed Front', $duplicated->sides[0]->printAreas[0]->name);
        $this->assertNotEquals($side->id, $duplicated->sides[0]->id);

        // Verify attributes & values duplicated
        $this->assertCount(1, $duplicated->attributes);
        $this->assertEquals('Paper Stock', $duplicated->attributes[0]->name);
        $this->assertCount(1, $duplicated->attributes[0]->values);
        $this->assertEquals('350gsm Silk', $duplicated->attributes[0]->values[0]->label);
        $this->assertEquals('350gsm_silk', $duplicated->attributes[0]->values[0]->value);
        $this->assertNotEquals($attr->id, $duplicated->attributes[0]->id);

        // Verify pricing matrices duplicated
        $this->assertCount(1, $duplicated->pricingMatrices);
        $this->assertEquals(500, $duplicated->pricingMatrices[0]->quantity);
        $this->assertEquals(0.11, $duplicated->pricingMatrices[0]->unit_price_ex_gst);
        $this->assertNotEquals($matrix->id, $duplicated->pricingMatrices[0]->id);

        // Verify shipping row duplicated
        $copiedShipping = DB::table('product_shippings')->where('product_id', $duplicated->id)->first();
        $this->assertNotNull($copiedShipping);
        $this->assertEquals(1.25, $copiedShipping->weight);
        $this->assertEquals(20, $copiedShipping->length);
    }

    public function test_customer_cannot_duplicate_product(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'Original Product ' . uniqid(),
            'slug' => 'orig-prod-' . uniqid(),
            'sku' => 'SKU-' . rand(100, 999),
            'base_price' => 10,
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->customerUser, 'sanctum')
            ->postJson("/api/v1/admin/products/{$product->id}/duplicate");

        $response->assertStatus(403);
    }
}
