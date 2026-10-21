<?php

namespace Tests\Feature;

use App\Models\CustomerEnquiry;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
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

    public function test_public_visitor_enquiry_dispatches_staff_and_customer_emails(): void
    {
        Mail::fake();

        $payload = [
            'name' => 'Alice Wonder',
            'email' => 'alice@example.com',
            'phone' => '0400 123 456',
            'product_name' => 'Custom Vinyl Banner',
            'quantity' => 10,
            'specifications' => [
                'size' => '3000x1000mm',
                'gsm' => '450 GSM Luxury',
            ],
            'additional_requirements' => 'Include eyelets every 500mm.',
            'privacy_consent' => true,
        ];

        $response = $this->postJson('/api/v1/enquiries', $payload);
        $response->assertStatus(201);

        Mail::assertSent(\App\Mail\CustomerEnquiryStaffMail::class);
        Mail::assertSent(\App\Mail\CustomerEnquiryCustomerMail::class, function ($mail) {
            return $mail->hasTo('alice@example.com');
        });
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

    public function test_public_enquiry_submission_seeds_initial_chat_message_and_token(): void
    {
        $payload = [
            'name' => 'Michael Scott',
            'email' => 'michael@dundermifflin.com',
            'product_name' => 'Dunder Mifflin Letterheads',
            'quantity' => 1000,
            'additional_requirements' => 'Needs to be watermarked paper.',
            'privacy_consent' => true,
        ];

        $res = $this->postJson('/api/v1/enquiries', $payload);
        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $enquiry = CustomerEnquiry::where('email', 'michael@dundermifflin.com')->first();
        $this->assertNotNull($enquiry);
        $this->assertNotEmpty($enquiry->access_token);
        $this->assertStringContainsString('/enquiries/conversation/' . $enquiry->access_token, $enquiry->conversation_url);

        // Verify initial chat message is seeded
        $this->assertDatabaseHas('customer_enquiry_messages', [
            'customer_enquiry_id' => $enquiry->id,
            'sender_type' => 'customer',
            'sender_name' => 'Michael Scott',
            'message' => 'Needs to be watermarked paper.',
        ]);
    }

    public function test_admin_can_send_reply_which_saves_to_db_and_mails_customer(): void
    {
        Mail::fake();

        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'Jim Halpert',
            'email' => 'jim@dundermifflin.com',
            'product_name' => 'Custom Notepads',
            'quantity' => 200,
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        Sanctum::actingAs($this->adminUser);

        $replyPayload = [
            'message' => 'Hello Jim, we can produce these 200 notepads for $320 ex GST within 3 business days.',
        ];

        $res = $this->postJson("/api/v1/admin/enquiries/{$enquiry->id}/messages", $replyPayload);
        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.message', $replyPayload['message']);

        // Check message stored in DB
        $this->assertDatabaseHas('customer_enquiry_messages', [
            'customer_enquiry_id' => $enquiry->id,
            'sender_type' => 'admin',
            'message' => $replyPayload['message'],
        ]);

        // Enquiry status updated to contacted
        $this->assertEquals(CustomerEnquiry::STATUS_CONTACTED, $enquiry->fresh()->status);

        // Email dispatched to customer
        Mail::assertSent(\App\Mail\CustomerEnquiryAdminReplyMail::class, function ($mail) use ($enquiry) {
            return $mail->hasTo($enquiry->email);
        });
    }

    public function test_customer_can_view_conversation_by_secure_token_without_login(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'Pam Beesly',
            'email' => 'pam@dundermifflin.com',
            'product_name' => 'Art Exhibition Postcards',
            'status' => CustomerEnquiry::STATUS_CONTACTED,
        ]);

        $enquiry->messages()->create([
            'sender_type' => 'customer',
            'sender_name' => 'Pam Beesly',
            'message' => 'Can you review my artwork?',
        ]);

        $enquiry->messages()->create([
            'sender_type' => 'admin',
            'sender_name' => 'Erry Imprints Prepress',
            'message' => 'Yes, artwork is print ready at 300 DPI.',
        ]);

        // Public access via access token
        $res = $this->getJson("/api/v1/enquiries/conversation/{$enquiry->access_token}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.reference', $enquiry->reference)
            ->assertJsonPath('data.name', 'Pam Beesly')
            ->assertJsonCount(2, 'data.messages');
    }

    public function test_customer_can_reply_via_token_which_saves_to_db_and_mails_admin(): void
    {
        Mail::fake();

        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'Dwight Schrute',
            'email' => 'dwight@beetfarms.com',
            'product_name' => 'Beet Festival Flyers',
            'status' => CustomerEnquiry::STATUS_CONTACTED,
        ]);

        $replyPayload = [
            'message' => 'Please proceed with 250 GSM gloss finish!',
        ];

        $res = $this->postJson("/api/v1/enquiries/conversation/{$enquiry->access_token}/reply", $replyPayload);

        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('customer_enquiry_messages', [
            'customer_enquiry_id' => $enquiry->id,
            'sender_type' => 'customer',
            'sender_name' => 'Dwight Schrute',
            'message' => $replyPayload['message'],
        ]);

        // Email dispatched to admin
        Mail::assertSent(\App\Mail\CustomerEnquiryCustomerReplyMail::class);
    }

    public function test_cannot_access_conversation_with_invalid_token(): void
    {
        $res = $this->getJson('/api/v1/enquiries/conversation/invalid-fake-token-12345');
        $res->assertStatus(404)
            ->assertJsonPath('success', false);

        $replyRes = $this->postJson('/api/v1/enquiries/conversation/invalid-fake-token-12345/reply', [
            'message' => 'Hello',
        ]);
        $replyRes->assertStatus(404);
    }
}
