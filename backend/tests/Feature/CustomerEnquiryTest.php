<?php

namespace Tests\Feature;

use App\Models\CustomerEnquiry;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerEnquiryTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Enquiry Tester',
            'email' => 'admin_enquiry_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Customer Tester',
            'email' => 'customer_enquiry_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);
    }

    public function test_public_visitor_can_submit_valid_enquiry(): void
    {
        $payload = [
            'name' => 'Jane Doe',
            'email' => 'jane.doe@example.com',
            'phone' => '0412 345 678',
            'product_name' => 'Premium Matte Business Cards',
            'quantity' => 500,
            'specifications' => [
                'gsm' => '350 GSM',
                'printing_sides' => 'Double-Sided',
                'finishing' => 'Matte Velvet',
            ],
            'delivery_location' => 'Sydney CBD, NSW 2000',
            'additional_requirements' => 'Need delivery by next Friday.',
            'privacy_consent' => true,
        ];

        $response = $this->postJson('/api/v1/enquiries', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'reference',
                    'name',
                    'email',
                    'product_name',
                    'status',
                    'created_at',
                ],
            ]);

        $this->assertDatabaseHas('customer_enquiries', [
            'email' => 'jane.doe@example.com',
            'name' => 'Jane Doe',
            'quantity' => 500,
            'status' => 'new',
        ]);
    }

    public function test_public_enquiry_requires_name_email_and_privacy_consent(): void
    {
        $response = $this->postJson('/api/v1/enquiries', [
            'phone' => '0400000000',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'privacy_consent']);
    }

    public function test_spam_honeypot_field_rejects_submission(): void
    {
        $response = $this->postJson('/api/v1/enquiries', [
            'name' => 'Spam Bot',
            'email' => 'bot@spammer.com',
            'privacy_consent' => true,
            'hp_company_website' => 'http://spam-link.ru',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['hp_company_website']);
    }

    public function test_public_enquiry_with_artwork_attachment(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->create('artwork_spec.pdf', 1024, 'application/pdf');

        $payload = [
            'name' => 'Alex Turner',
            'email' => 'alex@studio.com',
            'product_name' => 'Brochures A4',
            'quantity' => 1000,
            'privacy_consent' => true,
            'attachment' => $file,
        ];

        $response = $this->postJson('/api/v1/enquiries', $payload);

        $response->assertStatus(201);

        $enquiry = CustomerEnquiry::where('email', 'alex@studio.com')->first();
        $this->assertNotNull($enquiry);
        $this->assertNotNull($enquiry->attachment_path);
        $this->assertEquals('artwork_spec.pdf', $enquiry->attachment_original_name);
        Storage::disk('public')->assertExists($enquiry->attachment_path);
    }

    public function test_public_and_customer_cannot_access_admin_enquiries(): void
    {
        // Unauthenticated visitor
        $this->getJson('/api/v1/admin/enquiries')->assertStatus(401);

        // Regular customer (not admin)
        Sanctum::actingAs($this->customerUser);
        $this->getJson('/api/v1/admin/enquiries')->assertStatus(403);
    }

    public function test_admin_can_view_and_update_enquiry(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'Sarah Connor',
            'email' => 'sarah@skynet.com',
            'product_name' => 'Flyers',
            'quantity' => 250,
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        Sanctum::actingAs($this->adminUser);

        // Index
        $indexRes = $this->getJson('/api/v1/admin/enquiries');
        $indexRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // Show
        $showRes = $this->getJson('/api/v1/admin/enquiries/' . $enquiry->id);
        $showRes->assertStatus(200)
            ->assertJsonPath('data.name', 'Sarah Connor');

        // Update status to 'contacted'
        $updateRes = $this->patchJson('/api/v1/admin/enquiries/' . $enquiry->id, [
            'status' => 'contacted',
            'admin_notes' => 'Called client on phone. Quoted $150.',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.status', 'contacted')
            ->assertJsonPath('data.admin_notes', 'Called client on phone. Quoted $150.');

        $this->assertEquals('contacted', $enquiry->fresh()->status);
    }

    public function test_admin_can_delete_enquiry(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'To Delete',
            'email' => 'delete@example.com',
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        Sanctum::actingAs($this->adminUser);

        $deleteRes = $this->deleteJson('/api/v1/admin/enquiries/' . $enquiry->id);
        $deleteRes->assertStatus(200);

        $this->assertNull(CustomerEnquiry::find($enquiry->id));
    }
}
