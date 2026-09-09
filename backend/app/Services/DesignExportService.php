<?php

namespace App\Services;

use App\Models\DesignExport;
use App\Models\DesignImage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Imagick;
use RuntimeException;
use Throwable;
use ZipArchive;

class DesignExportService
{
    public function __construct(
        protected ImageQualityService $qualityService,
        protected ImageUpscaleService $upscaleService
    ) {}

    /**
     * Process a full design export from canvas data.
     *
     * @param DesignExport $export
     * @param array<string, mixed> $canvasPayload
     * @return DesignExport
     */
    public function processExport(DesignExport $export, array $canvasPayload): DesignExport
    {
        $export->update([
            'status' => DesignExport::STATUS_PROCESSING,
            'progress' => 10,
        ]);

        try {
            $format = strtolower($export->format);
            $targetDpi = (int) $export->target_dpi;
            $includeNormal = (bool) $export->include_normal;
            $includeEnhanced = (bool) $export->include_enhanced;
            $quality = (int) ($canvasPayload['quality'] ?? 95);
            $bgColor = $canvasPayload['background_color'] ?? '#ffffff';
            $documentName = Str::slug($canvasPayload['name'] ?? 'design', '_');

            $pages = $canvasPayload['pages'] ?? [];
            if (empty($pages)) {
                // Single page fallback
                $pages = [[
                    'canvas_json' => $canvasPayload['canvas_json'] ?? [],
                    'side' => 'front',
                    'name' => 'Front',
                    'preview_data_url' => $canvasPayload['preview_data_url'] ?? null,
                ]];
            }

            $dimensions = $canvasPayload['dimensions'] ?? [
                'width_mm' => 90,
                'height_mm' => 50,
                'width_px' => 1063,
                'height_px' => 591,
            ];

            $export->update(['progress' => 25]);

            // Track raster images analysis for report
            $imagesReport = [];
            $generatedFiles = [];

            // 1. Process and enhance images if enhanced version is requested
            if ($includeEnhanced) {
                $export->update(['progress' => 35]);
                $this->enhanceRasterImagesInPayload($pages, $dimensions, $targetDpi, $imagesReport);
            }

            $export->update(['progress' => 50]);

            // 2. Generate export files for each requested variant
            $variants = [];
            if ($includeNormal) {
                $variants[] = 'normal';
            }
            if ($includeEnhanced || empty($variants)) {
                $variants[] = 'enhanced';
            }

            foreach ($variants as $variant) {
                foreach ($pages as $pIdx => $pageData) {
                    $sideName = count($pages) > 1
                        ? ($pageData['side'] ?? "page_" . ($pIdx + 1))
                        : null;

                    $fileSuffix = $sideName
                        ? "{$sideName}-{$variant}-{$targetDpi}dpi"
                        : "{$variant}-{$targetDpi}dpi";

                    $outFilename = "{$documentName}-{$fileSuffix}.{$format}";

                    // Render file based on format
                    $filePath = $this->renderPageFormat(
                        format: $format,
                        pageData: $pageData,
                        dimensions: $dimensions,
                        targetDpi: $targetDpi,
                        variant: $variant,
                        quality: $quality,
                        backgroundColor: $bgColor,
                        filename: $outFilename
                    );

                    $generatedFiles[] = [
                        'path' => $filePath,
                        'filename' => $outFilename,
                        'side' => $sideName,
                        'variant' => $variant,
                    ];
                }
            }

            $export->update(['progress' => 80]);

            // 3. Build export report JSON
            $reportData = [
                'document_name' => $documentName,
                'format' => strtoupper($format),
                'quality_preset' => $export->quality_preset,
                'target_dpi' => $targetDpi,
                'dimensions' => $dimensions,
                'page_count' => count($pages),
                'include_normal' => $includeNormal,
                'include_enhanced' => $includeEnhanced,
                'images' => $imagesReport,
                'generated_at' => now()->toIso8601String(),
            ];

            // 4. If multiple files (or normal + enhanced requested), package into ZIP
            if (count($generatedFiles) > 1 || ($includeNormal && $includeEnhanced)) {
                $zipFilename = "{$documentName}-{$targetDpi}dpi.zip";
                $zipRelativePath = "exports/{$zipFilename}";
                $zipAbsolutePath = Storage::disk('public')->path($zipRelativePath);

                $zip = new ZipArchive();
                if ($zip->open($zipAbsolutePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                    throw new RuntimeException('Failed to create export ZIP archive.');
                }

                // Add all rendered files
                foreach ($generatedFiles as $f) {
                    $absPath = Storage::disk('public')->path($f['path']);
                    if (file_exists($absPath)) {
                        $zip->addFile($absPath, $f['filename']);
                    }
                }

                // Add export-report.json
                $zip->addFromString('export-report.json', json_encode($reportData, JSON_PRETTY_PRINT));
                $zip->close();

                $finalPath = $zipRelativePath;
                $finalFilename = $zipFilename;
                $finalMime = 'application/zip';
                $finalSize = filesize($zipAbsolutePath);
            } else {
                $single = $generatedFiles[0];
                $finalPath = $single['path'];
                $finalFilename = $single['filename'];
                $finalMime = $this->getMimeForFormat($format);
                $finalSize = Storage::disk('public')->size($finalPath);
            }

            $export->update([
                'status' => DesignExport::STATUS_COMPLETED,
                'progress' => 100,
                'file_path' => $finalPath,
                'file_name' => $finalFilename,
                'file_size' => $finalSize,
                'mime_type' => $finalMime,
                'report' => $reportData,
                'error_message' => null,
            ]);

            return $export->fresh();
        } catch (Throwable $e) {
            Log::error("Design export {$export->id} failed: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            $export->update([
                'status' => DesignExport::STATUS_FAILED,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Inspect all raster images in canvas JSON and enhance any low-resolution images with Real-ESRGAN.
     */
    protected function enhanceRasterImagesInPayload(
        array &$pages,
        array $dimensions,
        int $targetDpi,
        array &$imagesReport
    ): void {
        $canvasWidthPx = (float) ($dimensions['width_px'] ?? 1063);
        $canvasHeightPx = (float) ($dimensions['height_px'] ?? 591);
        $docWidthMm = (float) ($dimensions['width_mm'] ?? 90);
        $docHeightMm = (float) ($dimensions['height_mm'] ?? 50);

        foreach ($pages as &$page) {
            $canvasJson = &$page['canvas_json'];
            if (!isset($canvasJson['objects']) || !is_array($canvasJson['objects'])) {
                continue;
            }

            foreach ($canvasJson['objects'] as &$obj) {
                // Only process raster image objects (skip text, svg, shapes, paths, qr codes)
                $type = $obj['type'] ?? '';
                if ($type !== 'image' && $type !== 'fabricImage') {
                    continue;
                }

                $imageId = $obj['imageId'] ?? null;
                $sourceWidth = (float) ($obj['sourceWidth'] ?? $obj['width'] ?? 100);
                $sourceHeight = (float) ($obj['sourceHeight'] ?? $obj['height'] ?? 100);
                $objW = (float) ($obj['width'] ?? 100);
                $objH = (float) ($obj['height'] ?? 100);
                $scaleX = (float) ($obj['scaleX'] ?? 1.0);
                $scaleY = (float) ($obj['scaleY'] ?? 1.0);

                $crop = [
                    'cropX' => $obj['cropX'] ?? null,
                    'cropY' => $obj['cropY'] ?? null,
                    'cropWidth' => $obj['cropWidth'] ?? null,
                    'cropHeight' => $obj['cropHeight'] ?? null,
                ];

                $dpiInfo = $this->qualityService->calculateEffectiveDpi(
                    sourceWidth: $sourceWidth,
                    sourceHeight: $sourceHeight,
                    objectWidth: $objW,
                    objectHeight: $objH,
                    scaleX: $scaleX,
                    scaleY: $scaleY,
                    canvasWidthPx: $canvasWidthPx,
                    canvasHeightPx: $canvasHeightPx,
                    documentWidthMm: $docWidthMm,
                    documentHeightMm: $docHeightMm,
                    crop: $crop
                );

                $effectiveDpi = $dpiInfo['effective_dpi'];
                $analysis = $this->qualityService->analyzeQuality(
                    effectiveDpi: $effectiveDpi,
                    targetDpi: $targetDpi,
                    sourceWidth: (int) $sourceWidth,
                    sourceHeight: (int) $sourceHeight,
                    printedWidthInches: $dpiInfo['printed_width_in'],
                    printedHeightInches: $dpiInfo['printed_height_in']
                );

                $reportEntry = [
                    'image_id' => $imageId,
                    'original_dpi' => $effectiveDpi,
                    'target_dpi' => $targetDpi,
                    'requires_upscale' => $analysis['requires_upscale'],
                    'scale_applied' => 1,
                    'status' => 'original',
                ];

                // Upscale if required
                if ($analysis['requires_upscale']) {
                    $designImage = null;
                    if ($imageId) {
                        $designImage = DesignImage::find($imageId);
                    }

                    if (!$designImage && !empty($obj['src'])) {
                        // Register image from src
                        $parsedPath = preg_replace('#^.*?/api/v1/storage/#', '', $obj['src']);
                        if (Storage::disk('public')->exists($parsedPath)) {
                            $designImage = DesignImage::where('original_path', $parsedPath)->first();
                        }
                    }

                    if ($designImage) {
                        try {
                            $upscaled = $this->upscaleService->upscale($designImage, $analysis['recommended_scale']);
                            if (!empty($upscaled->upscaled_path)) {
                                $obj['upscaledSrc'] = $upscaled->upscaled_url;
                                $reportEntry['scale_applied'] = $analysis['recommended_scale'];
                                $reportEntry['final_dpi'] = round($effectiveDpi * $analysis['recommended_scale'], 1);
                                $reportEntry['status'] = 'enhanced';
                            }
                        } catch (Throwable $upErr) {
                            $reportEntry['status'] = 'failed: ' . $upErr->getMessage();
                        }
                    }
                }

                $imagesReport[] = $reportEntry;
            }
        }
    }

    /**
     * Render an individual page to the requested target format.
     */
    protected function renderPageFormat(
        string $format,
        array $pageData,
        array $dimensions,
        int $targetDpi,
        string $variant,
        int $quality,
        string $backgroundColor,
        string $filename
    ): string {
        $relativePath = "exports/{$filename}";
        $absolutePath = Storage::disk('public')->path($relativePath);

        // Ensure exports directory exists
        $dir = dirname($absolutePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $multiplier = max(1.0, $targetDpi / 72.0);

        // Check if a rendered base64/data URL or preview image was provided
        $base64 = $pageData['rendered_data_url']
            ?? $pageData['preview_data_url']
            ?? null;

        if ($base64 && str_starts_with($base64, 'data:image')) {
            $parts = explode(',', $base64, 2);
            $imageData = isset($parts[1]) ? base64_decode($parts[1]) : file_get_contents($base64);
        } else {
            // Create offscreen canvas representation using Imagick
            $wPx = (int) ceil(($dimensions['width_px'] ?? 1063) * ($multiplier / ($dimensions['width_px'] > 2000 ? 1 : 1)));
            $hPx = (int) ceil(($dimensions['height_px'] ?? 591) * ($multiplier / ($dimensions['height_px'] > 2000 ? 1 : 1)));

            $im = new Imagick();
            $im->newImage(max(100, $wPx), max(100, $hPx), new \ImagickPixel($backgroundColor));
            $im->setImageFormat('png32');
            $imageData = $im->getImageBlob();
            $im->destroy();
        }

        // Format-specific rendering via Imagick
        $imagick = new Imagick();
        $imagick->readImageBlob($imageData);
        $imagick->setImageResolution($targetDpi, $targetDpi);
        $imagick->setResolution($targetDpi, $targetDpi);

        switch ($format) {
            case 'jpeg':
            case 'jpg':
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality($quality);
                // Flatten transparency onto selected background
                $flattened = new Imagick();
                $flattened->newImage($imagick->getImageWidth(), $imagick->getImageHeight(), new \ImagickPixel($backgroundColor));
                $flattened->compositeImage($imagick, Imagick::COMPOSITE_OVER, 0, 0);
                $flattened->setImageResolution($targetDpi, $targetDpi);
                $flattened->setImageCompressionQuality($quality);
                $flattened->writeImage($absolutePath);
                $flattened->destroy();
                $imagick->destroy();
                break;

            case 'png':
                $imagick->setImageFormat('png32');
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;

            case 'webp':
                $imagick->setImageFormat('webp');
                $imagick->setImageCompressionQuality($quality);
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;

            case 'tiff':
            case 'tif':
                $imagick->setImageFormat('tiff');
                $imagick->setImageCompression(Imagick::COMPRESSION_LZW);
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;

            case 'pdf':
                $imagick->setImageFormat('pdf');
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;

            case 'psd':
                // Layered PSD is generated client-side or fallback raster PSD
                $imagick->setImageFormat('psd');
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;

            default:
                $imagick->setImageFormat('png32');
                $imagick->writeImage($absolutePath);
                $imagick->destroy();
                break;
        }

        return $relativePath;
    }

    protected function getMimeForFormat(string $format): string
    {
        return match ($format) {
            'jpeg', 'jpg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'tiff', 'tif' => 'image/tiff',
            'pdf' => 'application/pdf',
            'psd' => 'image/vnd.adobe.photoshop',
            default => 'application/octet-stream',
        };
    }
}
