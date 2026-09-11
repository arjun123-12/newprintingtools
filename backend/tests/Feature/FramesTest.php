<?php
namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class FramesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test creating a frame asset via admin endpoint.
     */
    public function test_admin_can_create_frame()
    {
        // Fake storage for uploads
        \Storage::fake('public');

        $mask = UploadedFile::fake()->image('mask.png', 200, 200);
        $thumb = UploadedFile::fake()->image('thumb.png', 50, 50);

        $payload = [
            'name' => 'Test Frame',
            'slug' => 'test-frame',
            'asset_type' => 'frame',
            'mask_file' => $mask,
            'thumbnail' => $thumb,
            'metadata' => json_encode([
                'shape' => 'rectangle',
                'width' => 200,
                'height' => 200,
            ]),
        ];

        // Assume authentication is not required for test (using withoutMiddleware)
        $response = $this->withoutMiddleware()
            ->postJson('/api/v1/admin/designer/assets', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('data.name', 'Test Frame');
        $response->assertJsonPath('data.asset_type', 'frame');

        // Verify files stored using path returned by API
        $data = $response->json('data');
        $this->assertArrayHasKey('path', $data);
        \Storage::disk('public')->assertExists($data['path']);
        $this->assertArrayHasKey('thumbnail_path', $data);
        \Storage::disk('public')->assertExists($data['thumbnail_path']);
    }
}
