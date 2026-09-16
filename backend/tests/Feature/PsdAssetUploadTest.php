<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PsdAssetUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_is_rejected(): void
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('layer.png', 200, 200);

        $response = $this->postJson('/api/v1/designer/psd-assets', [
            'image' => $file,
        ]);

        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_upload_psd_layer_asset(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        Sanctum::actingAs($user, ['*']);

        $file = UploadedFile::fake()->image('header_layer.png', 400, 300);

        $response = $this->postJson('/api/v1/designer/psd-assets', [
            'image' => $file,
            'psd_document_name' => 'Flyer.psd',
            'layer_name' => 'Header Text',
            'layer_id' => 'psd_layer_123',
        ]);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
            'message' => 'PSD layer asset uploaded successfully.',
        ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data['url']);
        $this->assertNotEmpty($data['file_url']);
        $this->assertEquals('image/png', $data['mime_type']);
        $this->assertStringContainsString('/storage/designer/psd-assets/', $data['url']);

        Storage::disk('public')->assertExists($data['path']);
    }

    public function test_invalid_mimetypes_are_rejected(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        Sanctum::actingAs($user, ['*']);

        $badFile = UploadedFile::fake()->create('script.php', 10, 'application/x-php');

        $response = $this->postJson('/api/v1/designer/psd-assets', [
            'image' => $badFile,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['image']);
    }
}
