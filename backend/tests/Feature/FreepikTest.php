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
        config(['services.freepik.api_key' => 'test_api_key']);
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
                        'content_type' => 'vector',
                        'image' => [
                            'source' => ['url' => 'https://example.com/test.jpg']
                        ],
                        'author' => ['name' => 'John Doe']
                    ]
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
                                 'type' => 'vector',
                                 'provider' => 'freepik'
                             ]
                         ],
                         'pagination' => [
                             'page' => 1,
                             'has_next' => true
                         ]
                     ]
                 ]);
    }

    public function test_freepik_search_handles_api_error()
    {
        $user = User::factory()->create();

        Http::fake([
            'api.freepik.com/v1/resources*' => Http::response([], 401)
        ]);

        Sanctum::actingAs($user);
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

        Http::fake([
            "api.freepik.com/v1/resources/{$assetId}/download" => Http::response([
                'data' => [
                    'url' => 'https://example.com/download.zip'
                ]
            ], 200),
            "api.freepik.com/v1/resources/{$assetId}" => Http::response([
                'data' => [
                    'id' => $assetId,
                    'title' => 'Test Download',
                    'content_type' => 'vector'
                ]
            ], 200)
        ]);

        Sanctum::actingAs($user);
        $response = $this->postJson("/api/v1/freepik/resources/{$assetId}/use");

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'id' => '123',
                         'url' => 'https://example.com/download.zip',
                         'title' => 'Test Download',
                         'provider' => 'freepik'
                     ]
                 ]);
    }
}
