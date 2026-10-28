<?php

namespace Tests\Feature;

use App\Models\CustomerEnquiry;
use App\Models\CustomerEnquiryMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiSupportChatTest extends TestCase
{
    use DatabaseTransactions;

    protected User $adminUser;
    protected User $customerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'Admin Chat Tester',
            'email' => 'admin_chat_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $this->customerUser = User::create([
            'name' => 'Alice Customer',
            'email' => 'alice_customer_' . uniqid() . '@example.com',
            'password' => 'secret123',
            'role' => 'customer',
        ]);
    }

    public function test_visitor_can_send_chat_message_and_receive_ai_reply(): void
    {
        config(['services.openai.api_key' => 'sk-test-key-12345']);

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => "Hello! At Erry Imprints, our Premium Matte Business Cards start from $45 AUD for 250 units with ~3 business days turnaround.",
                        ],
                    ],
                ],
            ], 200),
        ]);

        $sessionId = 'sess_' . uniqid();
        $payload = [
            'message' => 'Hi, how much are your business cards and what is the turnaround?',
            'session_id' => $sessionId,
            'name' => 'Sarah Connor',
            'email' => 'sarah@example.com',
        ];

        $response = $this->postJson('/api/v1/chat/message', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'reference',
                    'customer_message',
                    'ai_message',
                    'needs_human_followup',
                    'is_ai_enabled',
                ],
            ]);

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);

        // Verify conversation saved to database
        $this->assertDatabaseHas('customer_enquiries', [
            'access_token' => $token,
            'session_id' => $sessionId,
            'email' => 'sarah@example.com',
            'channel' => 'web_chat',
            'needs_human_followup' => false,
        ]);

        // Verify customer and AI messages in database
        $this->assertDatabaseHas('customer_enquiry_messages', [
            'sender_type' => CustomerEnquiryMessage::SENDER_CUSTOMER,
            'message' => 'Hi, how much are your business cards and what is the turnaround?',
        ]);

        $this->assertDatabaseHas('customer_enquiry_messages', [
            'sender_type' => CustomerEnquiryMessage::SENDER_AI,
            'sender_name' => 'Erry AI Support',
        ]);
    }

    public function test_customer_asking_for_human_triggers_followup_flag(): void
    {
        config(['services.openai.api_key' => 'sk-test-key-12345']);

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => "I understand you would like to speak with our staff. I have notified our prepress team and an agent will follow up with you shortly. [ESCALATE_HUMAN]",
                        ],
                    ],
                ],
            ], 200),
        ]);

        $sessionId = 'sess_' . uniqid();
        $payload = [
            'message' => 'Can I please speak with a human agent about a custom order?',
            'session_id' => $sessionId,
        ];

        $response = $this->postJson('/api/v1/chat/message', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.needs_human_followup', true);

        // Verify tag was stripped from client-facing text
        $aiText = $response->json('data.ai_message.message');
        $this->assertStringNotContainsString('[ESCALATE_HUMAN]', $aiText);

        $token = $response->json('data.token');
        $this->assertDatabaseHas('customer_enquiries', [
            'access_token' => $token,
            'needs_human_followup' => true,
        ]);
    }

    public function test_visitor_can_retrieve_chat_history_by_session_or_token(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'History Visitor',
            'email' => 'history@example.com',
            'session_id' => 'sess_history_123',
            'channel' => 'web_chat',
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_CUSTOMER,
            'sender_name' => 'History Visitor',
            'message' => 'First message in thread',
        ]);

        $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_AI,
            'sender_name' => 'Erry AI Support',
            'message' => 'AI answer in thread',
        ]);

        // Fetch by token
        $response = $this->getJson("/api/v1/chat/history?token={$enquiry->access_token}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.reference', $enquiry->reference)
            ->assertJsonCount(2, 'data.messages');

        // Fetch by session_id
        $resBySession = $this->getJson("/api/v1/chat/history?session_id=sess_history_123");
        $resBySession->assertStatus(200)
            ->assertJsonPath('data.token', $enquiry->access_token);
    }

    public function test_authenticated_customer_links_account_to_chat(): void
    {
        config(['services.openai.api_key' => 'sk-test-key-12345']);
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [['message' => ['content' => 'Hello Alice!']]],
            ], 200),
        ]);

        Sanctum::actingAs($this->customerUser);

        $payload = [
            'message' => 'Hello, I am logged in to my account.',
        ];

        $response = $this->postJson('/api/v1/chat/message', $payload);

        $response->assertStatus(201);
        $token = $response->json('data.token');

        $this->assertDatabaseHas('customer_enquiries', [
            'access_token' => $token,
            'user_id' => $this->customerUser->id,
            'email' => $this->customerUser->email,
        ]);
    }

    public function test_unauthorized_token_access_is_prevented(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'User One',
            'email' => 'user1@example.com',
            'session_id' => 'session_owner_111',
            'channel' => 'web_chat',
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        // Attempt to post with same token but different session_id without being logged in
        $response = $this->postJson('/api/v1/chat/message', [
            'token' => $enquiry->access_token,
            'session_id' => 'malicious_different_session_999',
            'message' => 'Attempting hijack',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_admin_can_toggle_ai_and_resolve_followup(): void
    {
        $enquiry = CustomerEnquiry::create([
            'reference' => CustomerEnquiry::generateReference(),
            'name' => 'Flagged Customer',
            'email' => 'flagged@example.com',
            'channel' => 'web_chat',
            'needs_human_followup' => true,
            'is_ai_enabled' => true,
            'status' => CustomerEnquiry::STATUS_NEW,
        ]);

        Sanctum::actingAs($this->adminUser);

        // Toggle AI off
        $resToggle = $this->postJson("/api/v1/admin/enquiries/{$enquiry->id}/toggle-ai", [
            'is_ai_enabled' => false,
        ]);
        $resToggle->assertStatus(200)
            ->assertJsonPath('data.is_ai_enabled', false);

        $enquiry->refresh();
        $this->assertFalse((bool) $enquiry->is_ai_enabled);

        // Resolve human follow-up
        $resResolve = $this->postJson("/api/v1/admin/enquiries/{$enquiry->id}/resolve-followup");
        $resResolve->assertStatus(200)
            ->assertJsonPath('data.needs_human_followup', false);

        $enquiry->refresh();
        $this->assertFalse((bool) $enquiry->needs_human_followup);
    }
}
