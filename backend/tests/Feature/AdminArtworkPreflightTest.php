<?php

namespace Tests\Feature;

use App\Enums\ArtworkStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Artwork;
use App\Models\ArtworkReview;
use App\Models\ArtworkVersion;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StaffAuditLog;
use App\Models\User;
use App\Services\Artwork\ArtworkValidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminArtworkPreflightTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $designer;
    protected User $orderStaff;
    protected User $customer;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin.test@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'is_super_admin' => true,
            'is_active' => true,
        ]);

        $this->designer = User::create([
            'name' => 'Assigned Designer',
            'email' => 'designer.test@example.com',
            'password' => Hash::make('password'),
            'role' => 'staff',
            'role_preset' => 'designer',
            'permissions' => ['artwork', 'templates'],
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->orderStaff = User::create([
            'name' => 'Orders Only Staff',
            'email' => 'orders.test@example.com',
            'password' => Hash::make('password'),
            'role' => 'staff',
            'permissions' => ['orders'], // no artwork permission
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->customer = User::create([
            'name' => 'Customer User',
            'email' => 'customer.test@example.com',
            'password' => Hash::make('password'),
            'role' => 'customer',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Cards & Print',
            'slug' => 'cards-print-' . Str::random(5),
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $category->id,
            'name' => 'Custom Business Cards',
            'slug' => 'custom-business-cards-' . Str::random(5),
            'sku' => 'BC-TEST',
            'product_type' => \App\Enums\ProductType::STATIONERY,
            'width_mm' => 90.0,
            'height_mm' => 54.0,
            'bleed_mm' => 2.0,
            'is_active' => true,
        ]);
    }

    protected function createSubmission(array $overrides = []): Artwork
    {
        $order = Order::create([
            'order_number' => 'PO-' . rand(10000, 99999),
            'user_id' => $this->customer->id,
            'status' => OrderStatus::ARTWORK_REVIEW,
            'payment_status' => PaymentStatus::PAID,
            'subtotal_ex_gst' => 100.00,
            'gst_amount' => 10.00,
            'shipping_fee_inc_gst' => 0.00,
            'discount_amount' => 0.00,
            'total_inc_gst' => 110.00,
            'currency' => 'AUD',
            'shipping_carrier' => 'Australia Post',
            'admin_notes' => 'Internal sensitive order notes for admin only',
            'shipping_address' => ['name' => 'Customer', 'address_line_1' => '123 Fake St'],
            'billing_address' => ['name' => 'Customer', 'address_line_1' => '123 Fake St'],
        ]);

        $artwork = Artwork::create(array_merge([
            'id' => (string) Str::uuid(),
            'user_id' => $this->customer->id,
            'product_id' => $this->product->id,
            'order_id' => $order->id,
            'assigned_designer_id' => $this->designer->id,
            'name' => 'Test Business Card',
            'file_name' => 'card.pdf',
            'source_type' => 'upload',
            'mime_type' => 'application/pdf',
            'file_size_bytes' => 1024000,
            'storage_disk' => 'public',
            'storage_path' => 'artworks/card.pdf',
            'width_px' => 1063,
            'height_px' => 638,
            'dpi' => 300,
            'bleed' => 2.0,
            'status' => ArtworkStatus::PREFLIGHT_PASSED,
            'review_status' => 'pending_review',
            'proof_status' => 'none',
            'current_version' => 1,
            'admin_notes' => 'Secret admin note: watch out for high ink coverage',
        ], $overrides));

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'product_sku' => $this->product->sku,
            'quantity' => 500,
            'unit_price_ex_gst' => 0.20,
            'unit_price_inc_gst' => 0.22,
            'total_price_inc_gst' => 110.00,
            'options_snapshot' => ['size_mm' => ['width' => 90, 'height' => 54]],
            'artwork_id' => $artwork->id,
            'production_status' => 'queued',
        ]);

        ArtworkVersion::create([
            'artwork_id' => $artwork->id,
            'version_number' => 1,
            'file_name' => $artwork->file_name,
            'file_size_bytes' => $artwork->file_size_bytes,
            'mime_type' => $artwork->mime_type,
            'storage_disk' => 'public',
            'storage_path' => $artwork->storage_path,
            'is_approved' => false,
            'uploaded_by' => $this->customer->id,
        ]);

        return $artwork;
    }

    public function test_super_admin_can_access_queue(): void
    {
        $this->createSubmission();

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/v1/admin/artwork-queue');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'stats', 'is_designer_view']);
    }

    public function test_staff_without_artwork_permission_cannot_access_queue(): void
    {
        Sanctum::actingAs($this->orderStaff);

        $response = $this->getJson('/api/v1/admin/artwork-queue');
        $response->assertForbidden();
    }

    public function test_designer_sees_only_assigned_submissions_and_no_pricing_or_admin_notes(): void
    {
        $assignedArtwork = $this->createSubmission([
            'assigned_designer_id' => $this->designer->id,
            'name' => 'Assigned Artwork',
        ]);

        $unassignedArtwork = $this->createSubmission([
            'assigned_designer_id' => null,
            'name' => 'Unassigned Artwork',
        ]);

        Sanctum::actingAs($this->designer);

        $response = $this->getJson('/api/v1/admin/artwork-queue');
        $response->assertOk();

        $data = $response->json('data.data');
        $names = collect($data)->pluck('name')->all();

        $this->assertContains('Assigned Artwork', $names);
        $this->assertNotContains('Unassigned Artwork', $names);

        // Verify pricing, payments, and admin_notes are completely stripped
        $assignedItem = collect($data)->firstWhere('name', 'Assigned Artwork');
        $this->assertNull($assignedItem['admin_notes']);
        $this->assertNull($assignedItem['order']['total_inc_gst']);
        $this->assertNull($assignedItem['order']['subtotal_ex_gst']);
        $this->assertNull($assignedItem['order']['admin_notes']);
        $this->assertNull($assignedItem['order_items'][0]['unit_price_inc_gst']);
    }

    public function test_designer_cannot_access_unassigned_artwork_detail(): void
    {
        $unassignedArtwork = $this->createSubmission([
            'assigned_designer_id' => null,
        ]);

        Sanctum::actingAs($this->designer);

        $response = $this->getJson('/api/v1/admin/artwork-queue/' . $unassignedArtwork->id);
        $response->assertForbidden();
    }

    public function test_super_admin_can_approve_artwork_and_logs_audit(): void
    {
        $artwork = $this->createSubmission();

        Sanctum::actingAs($this->superAdmin);

        $response = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/approve', [
            'notes' => 'Colors verified against CMYK Fogra39 profile. Ready for plate setting.',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $fresh = $artwork->fresh();
        $this->assertEquals('approved', $fresh->review_status);
        $this->assertEquals(ArtworkStatus::READY_FOR_PRODUCTION, $fresh->status);
        $this->assertEquals($this->superAdmin->id, $fresh->approved_by);

        // Verify review trail
        $this->assertDatabaseHas('artwork_reviews', [
            'artwork_id' => $artwork->id,
            'action' => 'approved',
            'reviewer_id' => $this->superAdmin->id,
        ]);

        // Verify staff audit log
        $this->assertDatabaseHas('staff_audit_logs', [
            'actor_id' => $this->superAdmin->id,
            'action' => 'artwork_approved',
        ]);
    }

    public function test_request_changes_requires_note_and_records_audit(): void
    {
        $artwork = $this->createSubmission();

        Sanctum::actingAs($this->designer);

        // Missing notes validation
        $failResponse = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/request-changes', []);
        $failResponse->assertUnprocessable();

        // Valid change request
        $response = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/request-changes', [
            'notes' => 'Please provide high-resolution 300 DPI vector artwork with 2mm bleed.',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $fresh = $artwork->fresh();
        $this->assertEquals('changes_requested', $fresh->review_status);
        $this->assertEquals(ArtworkStatus::REJECTED, $fresh->status);

        $this->assertDatabaseHas('artwork_reviews', [
            'artwork_id' => $artwork->id,
            'action' => 'changes_requested',
        ]);

        $this->assertDatabaseHas('staff_audit_logs', [
            'actor_id' => $this->designer->id,
            'action' => 'artwork_changes_requested',
        ]);
    }

    public function test_assign_designer_is_restricted_to_admin(): void
    {
        $artwork = $this->createSubmission(['assigned_designer_id' => null]);

        // Designer cannot reassign
        Sanctum::actingAs($this->designer);
        $denied = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/assign-designer', [
            'designer_id' => $this->designer->id,
        ]);
        $denied->assertForbidden();

        // Super Admin can assign
        Sanctum::actingAs($this->superAdmin);
        $allowed = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/assign-designer', [
            'designer_id' => $this->designer->id,
        ]);
        $allowed->assertOk()
            ->assertJsonPath('data.assigned_designer_id', $this->designer->id);

        $this->assertEquals($this->designer->id, $artwork->fresh()->assigned_designer_id);
    }

    public function test_generate_proof_updates_proof_status(): void
    {
        $artwork = $this->createSubmission();

        Sanctum::actingAs($this->designer);

        $response = $this->postJson('/api/v1/admin/artwork-queue/' . $artwork->id . '/generate-proof', [
            'notes' => 'Watermarked PDF proof ready for client sign-off.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.proof_status', 'generated');

        $fresh = $artwork->fresh();
        $this->assertEquals('generated', $fresh->proof_status);
        $this->assertNotNull($fresh->proof_generated_at);
    }

    public function test_preflight_service_identifies_missing_file_and_never_claims_fake_pass(): void
    {
        $service = new ArtworkValidationService();

        $artworkMissing = new Artwork([
            'source_type' => 'upload',
            'storage_path' => 'artworks/non_existent_file.pdf',
            'storage_disk' => 'public',
        ]);

        $results = $service->inspectArtwork($artworkMissing);

        $this->assertFalse($results['passed']);
        $this->assertEquals('preflight_failed', $results['status']);
        $this->assertContains('MISSING_FILE', $results['flags']);
        $this->assertEquals('unreadable', $results['metrics']['color_profile_status']);
    }

    public function test_preflight_service_calculates_estimated_dpi_at_target_print_size(): void
    {
        $service = new ArtworkValidationService();

        // 90mm width card with only 350px image width => DPI = (350 * 25.4) / 90 = ~98.7 DPI (Critical low resolution)
        $artworkLowRes = new Artwork([
            'source_type' => 'designer',
            'canvas_json' => ['objects' => []],
            'width_px' => 350,
            'height_px' => 210,
            'bleed' => 0.0,
        ]);

        $results = $service->inspectArtwork($artworkLowRes, ['width_mm' => 90.0, 'height_mm' => 54.0]);

        $this->assertEquals(99, $results['metrics']['estimated_dpi']);
        $this->assertEquals('failed', $results['metrics']['dpi_status']);
        $this->assertContains('CRITICAL_LOW_RESOLUTION', $results['flags']);
        $this->assertContains('NO_BLEED', $results['flags']);
    }

    public function test_public_api_does_not_expose_unapproved_artwork_drafts(): void
    {
        $unapprovedArtwork = $this->createSubmission([
            'review_status' => 'pending_review',
        ]);

        // Unauthenticated customer request
        $response = $this->getJson('/api/v1/artworks/' . $unapprovedArtwork->id . '/public');
        $response->assertForbidden();

        // Once approved, public API allows viewing
        $unapprovedArtwork->update(['review_status' => 'approved']);
        $approvedResponse = $this->getJson('/api/v1/artworks/' . $unapprovedArtwork->id . '/public');
        $approvedResponse->assertOk();
    }
}
