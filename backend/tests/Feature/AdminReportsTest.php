<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductType;
use App\Models\Artwork;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminReportsTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $productionStaff; // Has reports, no financial perms
    protected User $unauthorizedStaff; // No reports perm
    protected Category $category;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin.reports@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'is_super_admin' => true,
            'is_active' => true,
        ]);

        $this->productionStaff = User::create([
            'name' => 'Production Operator',
            'email' => 'operator.reports@example.com',
            'password' => Hash::make('password'),
            'role' => 'staff',
            'permissions' => ['reports'], // only reports, no orders/pricing/invoices
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->unauthorizedStaff = User::create([
            'name' => 'Support Agent',
            'email' => 'support.reports@example.com',
            'password' => Hash::make('password'),
            'role' => 'staff',
            'permissions' => ['customers'], // no reports
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'Marketing Print',
            'slug' => 'marketing-print-' . Str::random(5),
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'High Gloss Flyers',
            'slug' => 'high-gloss-flyers-' . Str::random(5),
            'sku' => 'FLY-GLOSS',
            'product_type' => ProductType::STANDARD_PRINT,
            'width_mm' => 148.0,
            'height_mm' => 210.0,
            'is_active' => true,
        ]);
    }

    protected function seedSampleOrder(array $attributes = []): Order
    {
        $created = $attributes['created_at'] ?? Carbon::now()->subDays(5);

        $order = new Order([
            'order_number' => 'PO-' . rand(10000, 99999),
            'user_id' => $this->superAdmin->id,
            'status' => $attributes['status'] ?? OrderStatus::DELIVERED,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => $attributes['subtotal'] ?? 200.00,
            'gst_amount' => $attributes['gst'] ?? 20.00,
            'shipping_fee_inc_gst' => 0.00,
            'discount_amount' => 0.00,
            'total_inc_gst' => $attributes['total'] ?? 220.00,
            'currency' => 'AUD',
            'shipping_address' => ['name' => 'Test', 'city' => 'Sydney'],
            'billing_address' => ['name' => 'Test', 'city' => 'Sydney'],
        ]);
        $order->created_at = $created;
        $order->updated_at = $created->copy()->addDays(2);
        $order->save(['timestamps' => false]);

        $artwork = new Artwork([
            'id' => (string) Str::uuid(),
            'user_id' => $this->superAdmin->id,
            'product_id' => $this->product->id,
            'order_id' => $order->id,
            'name' => 'Flyer Artwork',
            'file_name' => 'flyer.pdf',
            'source_type' => 'upload',
            'status' => 'ready_for_production',
            'review_status' => 'approved',
            'approved_at' => $created->copy()->addHours(6),
        ]);
        $artwork->created_at = $created;
        $artwork->save(['timestamps' => false]);

        $item = new OrderItem([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'product_sku' => $this->product->sku,
            'quantity' => $attributes['quantity'] ?? 1000,
            'unit_price_ex_gst' => 0.20,
            'unit_price_inc_gst' => 0.22,
            'total_price_inc_gst' => $attributes['total'] ?? 220.00,
            'options_snapshot' => [
                'stock' => '150gsm Gloss Artpaper',
                'finish' => 'Gloss UV Coating',
            ],
            'artwork_id' => $artwork->id,
            'production_status' => 'completed',
        ]);
        $item->created_at = $created;
        $item->save(['timestamps' => false]);

        $shipment = new Shipment([
            'order_id' => $order->id,
            'carrier' => 'Australia Post',
            'consignment_code' => 'AP-' . Str::random(8),
            'status' => 'delivered',
            'shipped_at' => $created->copy()->addDays(2),
            'delivered_at' => $created->copy()->addDays(3),
        ]);
        $shipment->created_at = $created->copy()->addDays(2);
        $shipment->save(['timestamps' => false]);

        return $order;
    }

    public function test_super_admin_can_access_reports_with_financials(): void
    {
        $this->seedSampleOrder(['total' => 220.00]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/reports?period=30d');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('can_view_financials', true)
            ->assertJsonPath('kpis.total_orders', 1);

        $this->assertEquals(220.00, (float) $response->json('kpis.total_revenue'));
        $this->assertEquals(220.00, (float) $response->json('kpis.average_order_value'));
        $response->assertJsonStructure([
            'kpis',
            'timeline',
            'top_products',
                'materials_usage',
                'turnaround',
            ]);
    }

    public function test_production_staff_can_access_operational_reports_with_financials_masked(): void
    {
        $this->seedSampleOrder(['total' => 220.00]);

        Sanctum::actingAs($this->productionStaff);

        $response = $this->getJson('/api/v1/admin/reports?period=30d');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('can_view_financials', false)
            ->assertJsonPath('kpis.total_orders', 1)
            ->assertJsonPath('kpis.total_revenue', null)
            ->assertJsonPath('kpis.average_order_value', null)
            ->assertJsonPath('kpis.total_units_printed', 1000);

        // Timeline revenue should be 0.00, but orders present
        $timeline = $response->json('timeline');
        $this->assertNotEmpty($timeline);
        $totalTimelineRev = collect($timeline)->sum('revenue');
        $this->assertEquals(0, $totalTimelineRev);
    }

    public function test_unauthorized_staff_cannot_access_reports(): void
    {
        Sanctum::actingAs($this->unauthorizedStaff);

        $response = $this->getJson('/api/v1/admin/reports');
        $response->assertForbidden();
    }

    public function test_date_range_filtering(): void
    {
        // Order within 7 days
        $this->seedSampleOrder([
            'created_at' => Carbon::now()->subDays(2),
            'total' => 150.00,
        ]);

        // Order outside 7 days (15 days ago)
        $this->seedSampleOrder([
            'created_at' => Carbon::now()->subDays(15),
            'total' => 300.00,
        ]);

        Sanctum::actingAs($this->superAdmin);

        // 7d period should return only 1 order
        $res7d = $this->getJson('/api/v1/admin/reports?period=7d');
        $res7d->assertOk()
            ->assertJsonPath('kpis.total_orders', 1);
        $this->assertEquals(150.00, (float) $res7d->json('kpis.total_revenue'));

        // 30d period should return both orders
        $res30d = $this->getJson('/api/v1/admin/reports?period=30d');
        $res30d->assertOk()
            ->assertJsonPath('kpis.total_orders', 2);
        $this->assertEquals(450.00, (float) $res30d->json('kpis.total_revenue'));
    }

    public function test_materials_usage_extracts_actual_stock_and_finish_attributes(): void
    {
        $this->seedSampleOrder(['quantity' => 1000]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/reports?period=30d');
        $response->assertOk();

        $materials = $response->json('materials_usage');
        $this->assertTrue($materials['has_data']);
        $this->assertEquals(1000, $materials['total_stock_units']);

        $stockNames = collect($materials['stocks'])->pluck('name')->all();
        $this->assertContains('150gsm Gloss Artpaper', $stockNames);

        $finishNames = collect($materials['finishes'])->pluck('name')->all();
        $this->assertContains('Gloss UV Coating', $finishNames);
    }

    public function test_turnaround_metrics_calculate_real_approval_and_fulfillment_speed(): void
    {
        $this->seedSampleOrder();

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/reports?period=30d');
        $response->assertOk();

        $turnaround = $response->json('turnaround');
        $this->assertTrue($turnaround['has_data']);
        $this->assertEquals(1, $turnaround['sample_size']);
        $this->assertEquals(6.0, $turnaround['avg_artwork_approval_hours']);
        $this->assertNotNull($turnaround['avg_total_fulfillment_days']);
    }

    public function test_filter_options_endpoint_returns_categories_and_products(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/reports/filter-options');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['categories', 'products']]);
    }
}
