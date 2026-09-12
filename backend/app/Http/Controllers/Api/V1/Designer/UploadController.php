<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use App\Models\CustomerUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class UploadController extends Controller
{
    /**
     * Convert professional design/image formats and the first PDF page to a
     * browser-safe PNG for Fabric.js.
     *
     * Requires the PHP Imagick extension. PDF/AI/EPS conversion additionally
     * requires Ghostscript to be installed and enabled for ImageMagick.
     */
    public function convertImage(Request $request): Response|JsonResponse
    {
        $filePath = null;
        $extension = null;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filePath = $file->getPathname();
            $extension = strtolower($file->getClientOriginalExtension());
        } elseif ($request->filled('image_url') || $request->filled('url')) {
            $url = (string) ($request->input('image_url') ?: $request->input('url'));
            $parsed = parse_url($url, PHP_URL_PATH);
            // Accept both the correct public URL and legacy URLs previously
            // returned as /api/v1/storage/....
            $relativePath = preg_replace(
                '#^/(?:api/v1/)?storage/#',
                '',
                $parsed ?? $url
            );
            if (Storage::disk('public')->exists($relativePath)) {
                $filePath = Storage::disk('public')->path($relativePath);
                $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Image file not found in storage.',
                ], 404);
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Please provide an image file or an image_url.',
            ], 422);
        }

        $allowedExtensions = [
            'pdf',
            'svg',
            'avif',
            'bmp',
            'psd',
            'ai',
            'eps',
            'tif',
            'tiff',
            'heic',
            'heif',
        ];

        if (!in_array($extension, $allowedExtensions, true)) {
            return response()->json([
                'success' => false,
                'message' => 'This file format cannot be converted.',
            ], 422);
        }

        if (!extension_loaded('imagick')) {
            return response()->json([
                'success' => false,
                'message' => 'Server image conversion is unavailable. Install and enable the PHP Imagick extension.',
            ], 503);
        }

        try {
            $image = new \Imagick();

            // Limit converter resources for untrusted uploads.
            $image->setResourceLimit(\Imagick::RESOURCETYPE_MEMORY, 256 * 1024 * 1024);
            $image->setResourceLimit(\Imagick::RESOURCETYPE_MAP, 256 * 1024 * 1024);
            $image->setResourceLimit(\Imagick::RESOURCETYPE_DISK, 512 * 1024 * 1024);
            $image->setResolution(300, 300);

            // [0] selects the composite/first page from PDF, PSD, AI, EPS or TIFF.
            $image->readImage($filePath . '[0]');
            $image->setIteratorIndex(0);

            // For multi-layer TIFF or artwork, merge layers cleanly
            if ($image->getNumberImages() > 1) {
                $image = $image->mergeImageLayers(\Imagick::LAYERMETHOD_COMPOSITE);
            }

            // Proper colorspace conversion: CMYK -> sRGB
            if ($image->getImageColorspace() === \Imagick::COLORSPACE_CMYK) {
                $image->transformImageColorspace(\Imagick::COLORSPACE_SRGB);
            } elseif ($image->getImageColorspace() !== \Imagick::COLORSPACE_SRGB) {
                $image->setImageColorspace(\Imagick::COLORSPACE_SRGB);
            }

            $width = $image->getImageWidth();
            $height = $image->getImageHeight();
            $largestDimension = max($width, $height);

            if ($largestDimension > 6000) {
                $scale = 6000 / $largestDimension;
                $image->resizeImage(
                    max(1, (int) round($width * $scale)),
                    max(1, (int) round($height * $scale)),
                    \Imagick::FILTER_LANCZOS,
                    1
                );
            }

            $image->setImageFormat('png32');
            $image->stripImage();

            $png = $image->getImageBlob();
            $convertedWidth = $image->getImageWidth();
            $convertedHeight = $image->getImageHeight();

            $image->clear();
            $image->destroy();

            if ($png === '') {
                throw new RuntimeException('Image conversion returned an empty file.');
            }

            return response($png, 200, [
                'Content-Type' => 'image/png',
                'Content-Length' => (string) strlen($png),
                'Content-Disposition' => 'inline; filename="converted-image.png"',
                'Cache-Control' => 'public, max-age=86400',
                'X-Image-Width' => (string) $convertedWidth,
                'X-Image-Height' => (string) $convertedHeight,
            ]);
        } catch (Throwable $exception) {
            Log::error('Professional image conversion failed.', [
                'extension' => $extension,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => in_array($extension, ['pdf', 'ai', 'eps'], true)
                    ? 'PDF/AI/EPS conversion failed. Verify that Ghostscript is installed and allowed by ImageMagick policy.'
                    : 'The uploaded file could not be converted to PNG.',
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : null,
            ], 422);
        }
    }

    /**
     * Store the transparent PNG produced by a background-removal process.
     */
    public function storeProcessedImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'image' => [
                'required',
                'file',
                'mimetypes:image/png',
                'max:10240',
            ],
            'processing_type' => [
                'sometimes',
                'string',
                'in:remove_background',
            ],
            'session_id' => ['nullable', 'string', 'max:255'],
            'source_upload_id' => ['nullable', 'string', 'max:255'],
            'source_provider' => ['nullable', 'string', 'max:100'],
            'source_provider_asset_id' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        return $this->storeImage(
            request: $request,
            file: $request->file('image'),
            validated: $validated,
            directory: 'designer/processed/remove-background',
            processingType: 'remove_background',
            successMessage: 'Processed image stored successfully.'
        );
    }

    /**
     * Store an image before Fabric.js canvas JSON is serialized.
     *
     * The frontend should use the returned URL as the Fabric image src. This
     * prevents data:image/base64 and blob: values from entering canvas_json.
     */
    public function storeCanvasImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'image' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png,webp,gif,svg,pdf,tif,tiff',
                'max:51200',
            ],
            'session_id' => ['nullable', 'string', 'max:255'],
            'source_upload_id' => ['nullable', 'string', 'max:255'],
            'source_provider' => ['nullable', 'string', 'max:100'],
            'source_provider_asset_id' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        $file = $request->file('image');
        $extension = strtolower($file->getClientOriginalExtension());

        // For PDF and TIFF, convert first page to browser-compatible PNG
        if (in_array($extension, ['tif', 'tiff', 'pdf'], true) && extension_loaded('imagick')) {
            try {
                $image = new \Imagick();
                $image->setResolution(300, 300);
                $image->readImage($file->getPathname() . '[0]');
                $image->setImageFormat('png32');
                $pngBlob = $image->getImageBlob();
                $convertedWidth = $image->getImageWidth();
                $convertedHeight = $image->getImageHeight();
                $image->clear();
                $image->destroy();

                $pngFilename = Str::uuid() . '.png';
                $path = 'designer/canvas-images/' . $pngFilename;
                Storage::disk('public')->put($path, $pngBlob);

                $url = url('/storage/' . ltrim($path, '/'));

                $upload = CustomerUpload::create([
                    'user_id' => $request->user()?->id,
                    'session_id' => $validated['session_id'] ?? (string) Str::uuid(),
                    'file_name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '.png',
                    'file_path' => $path,
                    'mime_type' => 'image/png',
                    'size_bytes' => strlen($pngBlob),
                    'width' => $convertedWidth,
                    'height' => $convertedHeight,
                    'processing_type' => 'converted_png',
                    'source_upload_id' => $validated['source_upload_id'] ?? null,
                    'source_provider' => $validated['source_provider'] ?? 'designer',
                    'source_provider_asset_id' => $validated['source_provider_asset_id'] ?? null,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Canvas image converted to PNG and uploaded successfully.',
                    'data' => [
                        'id' => $upload->id,
                        'url' => $url,
                        'file_url' => $url,
                        'path' => $path,
                        'file_path' => $path,
                        'mime_type' => 'image/png',
                        'width' => $convertedWidth,
                        'height' => $convertedHeight,
                        'size' => $upload->size_bytes,
                    ],
                ], 201);
            } catch (\Throwable $e) {
                Log::warning('Conversion to PNG failed in storeCanvasImage: ' . $e->getMessage());
            }
        }

        return $this->storeImage(
            request: $request,
            file: $request->file('image'),
            validated: $validated,
            directory: 'designer/canvas-images',
            processingType: 'canvas_image',
            successMessage: 'Canvas image uploaded successfully.'
        );
    }

    /**
     * Store the physical file and its CustomerUpload record atomically.
     */
    private function storeImage(
        Request $request,
        UploadedFile $file,
        array $validated,
        string $directory,
        string $processingType,
        string $successMessage
    ): JsonResponse {
        // Canvas images must always be publicly readable through /storage.
        // Do not depend on FILESYSTEM_DISK, which may be "local" in production.
        $disk = 'public';
        $mimeType = $file->getMimeType()
            ?: $file->getClientMimeType()
            ?: 'application/octet-stream';

        $clientExt = strtolower($file->getClientOriginalExtension());
        if (in_array($clientExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'tif', 'tiff'], true)) {
            $extension = $clientExt === 'tif' ? 'tiff' : $clientExt;
        } else {
            $extension = $this->extensionForMimeType($mimeType);
        }
        $fileName = Str::uuid() . '.' . $extension;
        $path = trim($directory, '/') . '/' . $fileName;
        $storedPath = null;

        $dimensions = @getimagesize($file->getPathname());
        $width = is_array($dimensions) ? $dimensions[0] : null;
        $height = is_array($dimensions) ? $dimensions[1] : null;

        if (!$width && ($extension === 'svg' || str_contains($mimeType, 'svg'))) {
            try {
                $svgXml = @simplexml_load_file($file->getPathname());
                if ($svgXml) {
                    $svgAttrs = $svgXml->attributes();
                    if (isset($svgAttrs->width) && isset($svgAttrs->height)) {
                        $width = (int) $svgAttrs->width;
                        $height = (int) $svgAttrs->height;
                    } elseif (isset($svgAttrs->viewBox)) {
                        $vb = preg_split('/[\s,]+/', (string) $svgAttrs->viewBox);
                        if (count($vb) === 4) {
                            $width = (int) round((float) $vb[2]);
                            $height = (int) round((float) $vb[3]);
                        }
                    }
                }
            } catch (\Throwable) {}
        }

        $sessionId = $validated['session_id']
            ?? ($request->hasSession()
                ? $request->session()->getId()
                : null)
            ?? (string) Str::uuid();

        DB::beginTransaction();

        try {
            $storedPath = $file->storeAs(
                trim($directory, '/'),
                $fileName,
                $disk
            );

            if (!$storedPath) {
                throw new RuntimeException(
                    'The image file could not be written to storage.'
                );
            }

            $upload = CustomerUpload::create([
                'user_id' => $request->user()?->id,
                'session_id' => $sessionId,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => $mimeType,
                'size_bytes' => $file->getSize(),
                'width' => $width,
                'height' => $height,
                'processing_type' => $processingType,
                'source_upload_id' => $validated['source_upload_id'] ?? null,
                'source_provider' => $validated['source_provider'] ?? null,
                'source_provider_asset_id' =>
                    $validated['source_provider_asset_id'] ?? null,
            ]);

            DB::commit();

            $url = url('/storage/' . ltrim($path, '/'));

            return response()->json([
                'success' => true,
                'message' => $successMessage,
                'data' => [
                    'id' => $upload->id,
                    'url' => $url,
                    'file_url' => $url,
                    'path' => $path,
                    'file_path' => $path,
                    'mime_type' => $mimeType,
                    'width' => $width,
                    'height' => $height,
                    'size' => $upload->size_bytes,
                ],
            ], 201);
        } catch (Throwable $exception) {
            DB::rollBack();

            if (
                $storedPath
                && Storage::disk($disk)->exists($storedPath)
            ) {
                Storage::disk($disk)->delete($storedPath);
            }

            Log::error('Designer image upload failed.', [
                'processing_type' => $processingType,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to store the designer image.',
                'error' => config('app.debug')
                    ? $exception->getMessage()
                    : null,
            ], 500);
        }
    }

    private function extensionForMimeType(string $mimeType): string
    {
        return match (strtolower($mimeType)) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'image/svg+xml', 'image/svg' => 'svg',
            'application/pdf', 'application/x-pdf' => 'pdf',
            'image/tiff', 'image/x-tiff' => 'tiff',
            default => 'bin',
        };
    }
}
