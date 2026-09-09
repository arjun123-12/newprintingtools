<?php

namespace Tests\Feature;

use App\Models\DesignExport;
use App\Models\DesignImage;
use App\Models\User;
use App\Services\DesignExportService;
use App\Services\ImageQualityService;
use App\Services\ImageUpscaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImageQualityAndUpscalerTest extends TestCase
{
    use RefreshDatabase;

    protected ImageQualityService $qualityService;
    protected ImageUpscaleService $upscaleService;
    protected DesignExportService $exportService;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->qualityService = app(ImageQualityService::class);
        $this->upscaleService = app(ImageUpscaleService::class);
        $this->exportService = app(DesignExportService::class);
    }

    public function test_dpi_calculation_formula(): void
    {
        // 500x500 px image displayed at 250x250 px on a 1063x591 px canvas (90x50 mm document)
        // displayedWidthMm = (250 / 1063) * 90 = 21.1665 mm
        // printedInches = 21.1665 / 25.4 = 0.8333 inches
        // effectiveDpi = 500 / 0.8333 = ~600 DPI
        $res = $this->qualityService->calculateEffectiveDpi(
            sourceWidth: 500,
            sourceHeight: 500,
            objectWidth: 250,
            objectHeight: 250,
            scaleX: 1.0,
            scaleY: 1.0,
            canvasWidthPx: 1063,
            canvasHeightPx: 591,
            documentWidthMm: 90,
            documentHeightMm: 50
        );

        $this->assertGreaterThan(500, $res['effective_dpi']);
        $this->assertLessThan(700, $res['effective_dpi']);
        $this->assertGreaterThan(0.5, $res['printed_width_in']);
    }

    public function test_quality_analysis_scale_selection(): void
    {
        // Case 1: Already high resolution -> recommended_scale = 1, requires_upscale = false
        $analysis1 = $this->qualityService->analyzeQuality(
            effectiveDpi: 350,
            targetDpi: 300,
            sourceWidth: 1000,
            sourceHeight: 1000,
            printedWidthInches: 2.85,
            printedHeightInches: 2.85
        );
        $this->assertFalse($analysis1['requires_upscale']);
        $this->assertEquals(1, $analysis1['recommended_scale']);
        $this->assertEquals('excellent', $analysis1['quality_level']);

        // Case 2: 160 DPI (< 300, but 160 * 2 = 320 >= 300) -> recommended_scale = 2
        $analysis2 = $this->qualityService->analyzeQuality(
            effectiveDpi: 160,
            targetDpi: 300,
            sourceWidth: 500,
            sourceHeight: 500,
            printedWidthInches: 3.125,
            printedHeightInches: 3.125
        );
        $this->assertTrue($analysis2['requires_upscale']);
        $this->assertEquals(2, $analysis2['recommended_scale']);

        // Case 3: 70 DPI (< 150) -> recommended_scale = 4, quality_level = low
        $analysis3 = $this->qualityService->analyzeQuality(
            effectiveDpi: 70,
            targetDpi: 300,
            sourceWidth: 200,
            sourceHeight: 200,
            printedWidthInches: 2.85,
            printedHeightInches: 2.85
        );
        $this->assertTrue($analysis3['requires_upscale']);
        $this->assertEquals(4, $analysis3['recommended_scale']);
        $this->assertEquals('low', $analysis3['quality_level']);
    }

    public function test_analyze_quality_api_endpoint(): void
    {
        $payload = [
            'source_width' => 600,
            'source_height' => 400,
            'object_width' => 300,
            'object_height' => 200,
            'scale_x' => 1.0,
            'scale_y' => 1.0,
            'canvas_width_px' => 1063,
            'canvas_height_px' => 591,
            'document_width_mm' => 90,
            'document_height_mm' => 50,
            'target_dpi' => 300,
            'quality_preset' => 'print',
        ];

        $response = $this->postJson('/api/v1/images/analyze-quality', $payload);
        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'target_dpi' => 300,
                     ],
                 ]);
    }

    public function test_ssrf_protection_blocks_malicious_ips(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->qualityService->assertSafeRemoteUrl('http://169.254.169.254/latest/meta-data/');
    }

    public function test_ssrf_protection_blocks_unauthorized_domains(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->qualityService->assertSafeRemoteUrl('https://evil-hacker-site.com/exploit.png');
    }

    public function test_register_image_via_upload(): void
    {
        $file = UploadedFile::fake()->image('test_logo.png', 400, 400);

        $response = $this->postJson('/api/v1/images/register', [
            'image' => $file,
            'session_id' => 'sess_test_123',
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'original_width' => 400,
                         'original_height' => 400,
                         'target_dpi' => 300,
                         'upscale_status' => 'not_required',
                     ],
                 ]);

        $this->assertDatabaseHas('design_images', [
            'original_width' => 400,
            'original_height' => 400,
        ]);
    }

    public function test_cached_upscale_prevents_duplicate_processing(): void
    {
        $checksum = 'abc123hash';
        $originalPath = 'images/originals/source.png';
        $upscaledPath = 'images/upscaled/enhanced.png';

        Storage::disk('public')->put($originalPath, 'dummy source');
        Storage::disk('public')->put($upscaledPath, 'dummy enhanced');

        // First image already completed
        $image1 = DesignImage::create([
            'file_name' => 'source.png',
            'original_path' => $originalPath,
            'upscaled_path' => $upscaledPath,
            'file_checksum' => $checksum,
            'original_width' => 200,
            'original_height' => 200,
            'upscaled_width' => 800,
            'upscaled_height' => 800,
            'upscale_factor' => 4,
            'upscale_status' => DesignImage::STATUS_COMPLETED,
        ]);

        // Second image with identical checksum
        $image2 = DesignImage::create([
            'file_name' => 'copy.png',
            'original_path' => $originalPath,
            'file_checksum' => $checksum,
            'original_width' => 200,
            'original_height' => 200,
            'upscale_status' => DesignImage::STATUS_NOT_REQUIRED,
        ]);

        $upscaled = $this->upscaleService->upscale($image2, 4);

        $this->assertEquals(DesignImage::STATUS_COMPLETED, $upscaled->upscale_status);
        $this->assertEquals($upscaledPath, $upscaled->upscaled_path);
        $this->assertEquals(800, $upscaled->upscaled_width);
    }

    public function test_export_api_creates_pending_job_and_status(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $payload = [
            'name' => 'My Business Card',
            'format' => 'png',
            'quality_preset' => 'print',
            'target_dpi' => 300,
            'include_normal' => true,
            'include_enhanced' => true,
            'dimensions' => [
                'width_mm' => 90,
                'height_mm' => 50,
                'width_px' => 1063,
                'height_px' => 591,
            ],
            'pages' => [
                [
                    'side' => 'front',
                    'name' => 'Front',
                    'canvas_json' => ['objects' => []],
                ],
                [
                    'side' => 'back',
                    'name' => 'Back',
                    'canvas_json' => ['objects' => []],
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/designer/export', $payload);
        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                 ]);

        $exportId = $response->json('data.id');
        $this->assertNotNull($exportId);

        // Check status endpoint
        $statusResp = $this->getJson("/api/v1/designer/exports/{$exportId}/status");
        $statusResp->assertStatus(200)
                   ->assertJson([
                       'success' => true,
                       'data' => [
                           'id' => $exportId,
                           'format' => 'png',
                           'target_dpi' => 300,
                       ],
                   ]);
    }
}
