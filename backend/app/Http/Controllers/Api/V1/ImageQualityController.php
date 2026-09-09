<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\UpscaleImageJob;
use App\Models\DesignImage;
use App\Services\ImageQualityService;
use App\Services\ImageUpscaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class ImageQualityController extends Controller
{
    public function __construct(
        protected ImageQualityService $qualityService,
        protected ImageUpscaleService $upscaleService
    ) {}

    /**
     * Analyze the effective print DPI and enhancement requirements of a Fabric image.
     */
    public function analyzeQuality(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_width' => ['required', 'numeric', 'min:1'],
            'source_height' => ['required', 'numeric', 'min:1'],
            'object_width' => ['required', 'numeric', 'min:1'],
            'object_height' => ['required', 'numeric', 'min:1'],
            'scale_x' => ['nullable', 'numeric'],
            'scale_y' => ['nullable', 'numeric'],
            'canvas_width_px' => ['required', 'numeric', 'min:1'],
            'canvas_height_px' => ['required', 'numeric', 'min:1'],
            'document_width_mm' => ['required', 'numeric', 'min:1'],
            'document_height_mm' => ['required', 'numeric', 'min:1'],
            'target_dpi' => ['nullable', 'integer', 'min:50', 'max:1200'],
            'quality_preset' => ['nullable', 'string', 'in:web,standard,print,ultra,custom'],
            'custom_dpi' => ['nullable', 'integer', 'min:50', 'max:1200'],
            'crop' => ['nullable', 'array'],
            'crop.cropX' => ['nullable', 'numeric'],
            'crop.cropY' => ['nullable', 'numeric'],
            'crop.cropWidth' => ['nullable', 'numeric'],
            'crop.cropHeight' => ['nullable', 'numeric'],
        ]);

        $scaleX = (float) ($validated['scale_x'] ?? 1.0);
        $scaleY = (float) ($validated['scale_y'] ?? 1.0);
        $preset = $validated['quality_preset'] ?? ImageQualityService::PRESET_PRINT;
        $targetDpi = $this->qualityService->resolveTargetDpi($preset, $validated['custom_dpi'] ?? $validated['target_dpi'] ?? null);

        $dpiResult = $this->qualityService->calculateEffectiveDpi(
            sourceWidth: (float) $validated['source_width'],
            sourceHeight: (float) $validated['source_height'],
            objectWidth: (float) $validated['object_width'],
            objectHeight: (float) $validated['object_height'],
            scaleX: $scaleX,
            scaleY: $scaleY,
            canvasWidthPx: (float) $validated['canvas_width_px'],
            canvasHeightPx: (float) $validated['canvas_height_px'],
            documentWidthMm: (float) $validated['document_width_mm'],
            documentHeightMm: (float) $validated['document_height_mm'],
            crop: $validated['crop'] ?? []
        );

        $analysis = $this->qualityService->analyzeQuality(
            effectiveDpi: $dpiResult['effective_dpi'],
            targetDpi: $targetDpi,
            sourceWidth: (int) $validated['source_width'],
            sourceHeight: (int) $validated['source_height'],
            printedWidthInches: $dpiResult['printed_width_in'],
            printedHeightInches: $dpiResult['printed_height_in']
        );

        return response()->json([
            'success' => true,
            'data' => array_merge($analysis, [
                'printed_width_in' => $dpiResult['printed_width_in'],
                'printed_height_in' => $dpiResult['printed_height_in'],
            ]),
        ]);
    }

    /**
     * Register an uploaded or external image for upscale tracking.
     */
    public function registerImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'image' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:51200'],
            'image_url' => ['nullable', 'string', 'url', 'max:1000'],
            'session_id' => ['nullable', 'string', 'max:255'],
            'source_provider' => ['nullable', 'string', 'max:100'],
            'source_asset_id' => ['nullable', 'string', 'max:255'],
        ]);

        $userId = $request->user()?->id;
        $sessionId = $validated['session_id'] ?? (string) Str::uuid();

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $ext = strtolower($file->getClientOriginalExtension());
            $filename = Str::uuid() . '.' . $ext;
            $relativePath = "images/originals/{$filename}";

            Storage::disk('public')->put($relativePath, file_get_contents($file->getPathname()));
            $info = @getimagesize($file->getPathname());
            $width = $info[0] ?? 0;
            $height = $info[1] ?? 0;
            $checksum = hash_file('sha256', $file->getPathname());
            $size = $file->getSize();
            $mime = $file->getMimeType();
        } elseif (!empty($validated['image_url'])) {
            try {
                $downloaded = $this->qualityService->fetchAndStoreRemoteImage($validated['image_url'], 'originals');
                $relativePath = $downloaded['path'];
                $width = $downloaded['width'];
                $height = $downloaded['height'];
                $checksum = $downloaded['checksum'];
                $size = $downloaded['size_bytes'];
                $mime = $downloaded['mime_type'];
                $filename = $downloaded['file_name'];
            } catch (Throwable $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to download external image: ' . $e->getMessage(),
                ], 422);
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Provide an image file or an image_url.',
            ], 422);
        }

        $designImage = DesignImage::create([
            'user_id' => $userId,
            'session_id' => $sessionId,
            'file_name' => $filename,
            'original_path' => $relativePath,
            'file_checksum' => $checksum,
            'original_width' => $width,
            'original_height' => $height,
            'mime_type' => $mime,
            'size_bytes' => $size,
            'source_provider' => $validated['source_provider'] ?? 'upload',
            'source_asset_id' => $validated['source_asset_id'] ?? null,
            'upscale_status' => DesignImage::STATUS_NOT_REQUIRED,
        ]);

        return response()->json([
            'success' => true,
            'data' => $designImage->toTrackingArray(),
        ]);
    }

    /**
     * Trigger Real-ESRGAN upscaling for a specific registered image.
     */
    public function upscale(Request $request, string $imageId): JsonResponse
    {
        $designImage = DesignImage::findOrFail($imageId);

        // Verify ownership (either user owns it or session matches, or admin)
        $this->authorizeImageAccess($request, $designImage);

        $validated = $request->validate([
            'scale' => ['nullable', 'integer', 'in:2,4'],
            'target_dpi' => ['nullable', 'integer', 'min:50', 'max:1200'],
        ]);

        $scale = (int) ($validated['scale'] ?? 4);
        if (!empty($validated['target_dpi'])) {
            $designImage->update(['target_dpi' => (int) $validated['target_dpi']]);
        }

        // If already completed and file exists, return immediately
        if ($designImage->upscale_status === DesignImage::STATUS_COMPLETED && !empty($designImage->upscaled_path)) {
            if (Storage::disk('public')->exists($designImage->upscaled_path)) {
                return response()->json([
                    'success' => true,
                    'message' => 'Image is already enhanced.',
                    'data' => $designImage->toTrackingArray(),
                ]);
            }
        }

        // If currently processing, return tracking info
        if ($designImage->upscale_status === DesignImage::STATUS_PROCESSING) {
            return response()->json([
                'success' => true,
                'message' => 'Upscaling is currently in progress.',
                'data' => $designImage->toTrackingArray(),
            ]);
        }

        // Dispatch job or run synchronously depending on environment / config
        if (config('queue.default') === 'sync') {
            try {
                $this->upscaleService->upscale($designImage, $scale);
                return response()->json([
                    'success' => true,
                    'message' => 'Image upscaled successfully.',
                    'data' => $designImage->fresh()->toTrackingArray(),
                ]);
            } catch (Throwable $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Upscaling failed: ' . $e->getMessage(),
                    'data' => $designImage->fresh()->toTrackingArray(),
                ], 500);
            }
        }

        $designImage->update([
            'upscale_status' => DesignImage::STATUS_PENDING,
            'upscale_factor' => $scale,
            'upscale_error' => null,
        ]);

        UpscaleImageJob::dispatch($designImage->id, $scale);

        return response()->json([
            'success' => true,
            'message' => 'Upscaling job queued.',
            'data' => $designImage->fresh()->toTrackingArray(),
        ]);
    }

    /**
     * Get the current upscale tracking status of an image.
     */
    public function upscaleStatus(Request $request, string $imageId): JsonResponse
    {
        $designImage = DesignImage::findOrFail($imageId);
        $this->authorizeImageAccess($request, $designImage);

        return response()->json([
            'success' => true,
            'data' => $designImage->toTrackingArray(),
        ]);
    }

    protected function authorizeImageAccess(Request $request, DesignImage $image): void
    {
        $user = $request->user();
        if ($user && $user->role === 'admin') {
            return;
        }

        if ($user && $image->user_id && $image->user_id === $user->id) {
            return;
        }

        $sessionId = $request->header('X-Session-ID') ?: $request->input('session_id');
        if ($sessionId && $image->session_id === $sessionId) {
            return;
        }

        // For public/guest preview images without strict user ownership:
        if (!$image->user_id) {
            return;
        }

        abort(403, 'Unauthorized access to this image asset.');
    }
}
