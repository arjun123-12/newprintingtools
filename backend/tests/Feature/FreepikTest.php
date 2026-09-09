<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Http;

use Laravel\Sanctum\Sanctum;

class FreepikTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.freepik.api_key' => 'test_api_key',
            'services.freepik.api_url' => 'https://api.freepik.com/v1',
        ]);
    }

    public function test_freepik_search_requires_authentication()
    {
        $response = $this->getJson('/api/v1/freepik/search?q=business');
        $response->assertStatus(401);
    }

    public function test_freepik_search_validates_query()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/freepik/search');
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['q']);
    }

    public function test_freepik_search_success()
    {
        $user = User::factory()->create();

        Http::fake([
            'api.freepik.com/v1/resources*' => Http::response([
                'data' => [
                    [
                        'id' => 123,
                        'title' => 'Test Business Card',
                        'type' => 'vector',
                        'content_type' => 'vector',
                        'image' => [
                            'source' => ['url' => 'https://example.com/test.jpg']
                        ],
                        'author' => ['name' => 'John Doe']
                    ]
                ],
                'pagination' => [
                    'total_pages' => 2,
                    'has_next' => true
                ],
                'meta' => [
                    'total_pages' => 2
                ]
            ], 200)
        ]);

        Sanctum::actingAs($user);
        $response = $this->getJson('/api/v1/freepik/search?q=business');

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'items' => [
                             [
                                 'id' => '123',
                                 'title' => 'Test Business Card',
                                 'provider' => 'freepik'
                             ]
                         ]
                     ]
                 ]);
    }

    public function test_freepik_search_handles_api_error()
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        Http::fake([
            'api.freepik.com/v1/resources*' => Http::response([
                'message' => 'Invalid API key'
            ], 401)
        ]);

        $response = $this->getJson('/api/v1/freepik/search?q=business');
        $response->assertStatus(401)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Freepik authentication failed.'
                 ]);
    }

    public function test_freepik_use_asset_success()
    {
        $user = User::factory()->create();
        
        $assetId = 123;

        // 1x1 transparent PNG for fake download
        $fakePng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

        Http::fake([
            "api.freepik.com/v1/resources/{$assetId}/download" => Http::response([
                'data' => [
                    'url' => 'https://example.com/download.jpg'
                ]
            ], 200),
            "api.freepik.com/v1/resources/{$assetId}" => Http::response([
                'data' => [
                    'id' => $assetId,
                    'title' => 'Test Download',
                    'content_type' => 'photo',
                    'image' => [
                        'source' => ['url' => 'https://example.com/download.jpg']
                    ]
                ]
            ], 200),
            'https://example.com/download.jpg' => Http::response($fakePng, 200, ['Content-Type' => 'image/png']),
        ]);

        Sanctum::actingAs($user);
        $response = $this->postJson("/api/v1/freepik/resources/{$assetId}/use");

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'id' => '123',
                         'title' => 'Test Download',
                         'provider' => 'freepik'
                     ]
                 ]);
    }
}
