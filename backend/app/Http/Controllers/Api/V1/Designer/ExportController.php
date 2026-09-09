<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDesignExportJob;
use App\Models\DesignExport;
use App\Services\DesignExportService;
use App\Services\ImageQualityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ExportController extends Controller
{
    public function __construct(
        protected DesignExportService $exportService,
        protected ImageQualityService $qualityService
    ) {}

    /**
     * Dispatch or synchronously execute a multi-format design export.
     */
    public function export(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100'],
            'format' => ['required', 'string', 'in:jpeg,jpg,png,webp,pdf,tiff,tif,psd'],
            'quality_preset' => ['nullable', 'string', 'in:web,standard,print,ultra,custom'],
            'custom_dpi' => ['nullable', 'integer', 'min:50', 'max:1200'],
            'target_dpi' => ['nullable', 'integer', 'min:50', 'max:1200'],
            'include_normal' => ['nullable', 'boolean'],
            'include_enhanced' => ['nullable', 'boolean'],
            'quality' => ['nullable', 'integer', 'min:60', 'max:100'],
            'background_color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'artwork_id' => ['nullable', 'uuid'],
            'session_id' => ['nullable', 'string', 'max:255'],
            'dimensions' => ['required', 'array'],
            'dimensions.width_mm' => ['nullable', 'numeric', 'min:1'],
            'dimensions.height_mm' => ['nullable', 'numeric', 'min:1'],
            'dimensions.width_px' => ['nullable', 'numeric', 'min:1'],
            'dimensions.height_px' => ['nullable', 'numeric', 'min:1'],
            'pages' => ['nullable', 'array'],
            'canvas_json' => ['nullable', 'array'],
            'preview_data_url' => ['nullable', 'string'],
        ]);

        $userId = $request->user()?->id;
        $sessionId = $validated['session_id'] ?? (string) Str::uuid();

        // Rate limiting / concurrency check: limit active pending/processing exports
        $activeCount = DesignExport::where(function ($q) use ($userId, $sessionId) {
            if ($userId) {
                $q->where('user_id', $userId);
            } else {
                $q->where('session_id', $sessionId);
            }
        })
        ->whereIn('status', [DesignExport::STATUS_PENDING, DesignExport::STATUS_PROCESSING])
        ->count();

        if ($activeCount >= 3) {
            return response()->json([
                'success' => false,
                'message' => 'You already have 3 export tasks in progress. Please wait for them to finish.',
            ], 429);
        }

        $preset = $validated['quality_preset'] ?? ImageQualityService::PRESET_PRINT;
        $targetDpi = $this->qualityService->resolveTargetDpi($preset, $validated['custom_dpi'] ?? $validated['target_dpi'] ?? null);

        $includeNormal = (bool) ($validated['include_normal'] ?? false);
        $includeEnhanced = (bool) ($validated['include_enhanced'] ?? true);

        // Normalize format
        $format = strtolower($validated['format']);
        if ($format === 'jpg') {
            $format = 'jpeg';
        }
        if ($format === 'tif') {
            $format = 'tiff';
        }

        $export = DesignExport::create([
            'user_id' => $userId,
            'session_id' => $sessionId,
            'artwork_id' => $validated['artwork_id'] ?? null,
            'status' => DesignExport::STATUS_PENDING,
            'progress' => 0,
            'format' => $format,
            'quality_preset' => $preset,
            'target_dpi' => $targetDpi,
            'include_normal' => $includeNormal,
            'include_enhanced' => $includeEnhanced,
        ]);

        // Process export synchronously if sync queue or small payload
        if (config('queue.default') === 'sync') {
            try {
                $this->exportService->processExport($export, $validated);
                return response()->json([
                    'success' => true,
                    'message' => 'Export completed successfully.',
                    'data' => $export->fresh()->toStatusArray(),
                ]);
            } catch (Throwable $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Export failed: ' . $e->getMessage(),
                    'data' => $export->fresh()->toStatusArray(),
                ], 500);
            }
        }

        ProcessDesignExportJob::dispatch($export->id, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Export job started.',
            'data' => $export->fresh()->toStatusArray(),
        ]);
    }

    /**
     * Poll status of an active or completed export.
     */
    public function status(Request $request, string $exportId): JsonResponse
    {
        $export = DesignExport::findOrFail($exportId);
        $this->authorizeExportAccess($request, $export);

        return response()->json([
            'success' => true,
            'data' => $export->toStatusArray(),
        ]);
    }

    /**
     * Download the completed export file.
     */
    public function download(Request $request, string $exportId): BinaryFileResponse|JsonResponse
    {
        $export = DesignExport::findOrFail($exportId);
        $this->authorizeExportAccess($request, $export);

        if ($export->status !== DesignExport::STATUS_COMPLETED || empty($export->file_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Export is not ready for download.',
                'status' => $export->status,
            ], 400);
        }

        if (!Storage::disk('public')->exists($export->file_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Export file was not found in storage.',
            ], 404);
        }

        $absolutePath = Storage::disk('public')->path($export->file_path);
        $filename = $export->file_name ?: basename($absolutePath);

        // Sanitize filename to prevent header injection
        $sanitizedFilename = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename);

        return response()->download($absolutePath, $sanitizedFilename, [
            'Content-Type' => $export->mime_type ?: 'application/octet-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    protected function authorizeExportAccess(Request $request, DesignExport $export): void
    {
        $user = $request->user();
        if ($user && $user->role === 'admin') {
            return;
        }

        if ($user && $export->user_id && $export->user_id === $user->id) {
            return;
        }

        $sessionId = $request->header('X-Session-ID') ?: $request->input('session_id');
        if ($sessionId && $export->session_id === $sessionId) {
            return;
        }

        if (!$export->user_id) {
            return;
        }

        abort(403, 'Unauthorized access to this design export.');
    }
}
