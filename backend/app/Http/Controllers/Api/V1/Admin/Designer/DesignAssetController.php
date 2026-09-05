<?php

namespace App\Http\Controllers\Api\V1\Admin\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignAsset;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DesignAssetController extends Controller
{
    private const ALLOWED_ASSET_EXTENSIONS = [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'avif',
        'gif',
        'svg',
        'bmp',
        'tif',
        'tiff',
        'psd',
        'ai',
        'eps',
        'pdf',
    ];

    private const ALLOWED_THUMBNAIL_EXTENSIONS = [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'avif',
    ];

    /**
     * These formats can be stored, but browsers and Fabric.js cannot render
     * them directly. Supply a PNG, JPG, WebP or AVIF thumbnail for preview.
     */
    private const FORMATS_REQUIRING_CONVERSION = [
        'psd',
        'ai',
        'eps',
        'pdf',
        'tif',
        'tiff',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = DesignAsset::query()->with('category');

        if ($request->filled('search')) {
            $query->where(
                'name',
                'like',
                '%' . (string) $request->input('search') . '%'
            );
        }

        if ($request->filled('asset_type')) {
            $query->where('asset_type', (string) $request->input('asset_type'));
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', (string) $request->input('category_id'));
        }

        $perPage = max(1, min((int) $request->input('per_page', 24), 100));

        $assets = $query
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $assets,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->coerceFormDataFields($request);

        $validated = $request->validate([
            'category_id' => ['nullable', 'uuid', 'exists:design_asset_categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:design_assets,slug'],
            'asset_type' => ['required', 'string', 'in:text,frame,photo,element,background'],
            'fabric_json' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
            'provider' => ['nullable', 'string', 'max:255'],
            'provider_asset_id' => ['nullable', 'string', 'max:255'],
            'license_name' => ['nullable', 'string', 'max:255'],
            'attribution' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'file' => $this->assetFileRules(),
            'thumbnail' => $this->thumbnailFileRules(),
        ]);

        $validated['provider'] = $validated['provider'] ?? 'admin';

        $assetData = collect($validated)
            ->except(['file', 'thumbnail'])
            ->toArray();

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $storedFile = $this->storeUploadedFile(
                $file,
                "designer/{$validated['asset_type']}s"
            );

            $assetData['file_path'] = $storedFile['path'];
            $assetData['file_url'] = $storedFile['url'];
            $assetData = $this->addSourceMetadata(
                $assetData,
                $storedFile['extension']
            );

            // If user did not provide an explicit thumbnail, resolve or generate a web-renderable thumbnail preview.
            if (!$request->hasFile('thumbnail')) {
                $autoThumb = $this->resolveThumbnailForAsset($storedFile, $validated['name'] ?? null);
                if ($autoThumb) {
                    $assetData['thumbnail_path'] = $autoThumb['path'];
                    $assetData['thumbnail_url'] = $autoThumb['url'];
                }
            }
        }

        if ($request->hasFile('thumbnail')) {
            $storedThumbnail = $this->storeUploadedFile(
                $request->file('thumbnail'),
                'designer/thumbnails'
            );

            $assetData['thumbnail_path'] = $storedThumbnail['path'];
            $assetData['thumbnail_url'] = $storedThumbnail['url'];
        }

        $asset = DesignAsset::create($assetData);
        $asset->load('category');

        return response()->json([
            'success' => true,
            'message' => 'Asset created successfully.',
            'data' => $asset,
        ], 201);
    }

    public function show(DesignAsset $asset): JsonResponse
    {
        $asset->load('category');

        return response()->json([
            'success' => true,
            'data' => $asset,
        ]);
    }

    public function update(Request $request, DesignAsset $asset): JsonResponse
    {
        $this->coerceFormDataFields($request);

        $validated = $request->validate([
            'category_id' => ['nullable', 'uuid', 'exists:design_asset_categories,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('design_assets', 'slug')->ignore($asset->id),
            ],
            'asset_type' => ['sometimes', 'required', 'string', 'in:text,frame,photo,element,background'],
            'fabric_json' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
            'provider' => ['nullable', 'string', 'max:255'],
            'provider_asset_id' => ['nullable', 'string', 'max:255'],
            'license_name' => ['nullable', 'string', 'max:255'],
            'attribution' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'file' => $this->assetFileRules(),
            'thumbnail' => $this->thumbnailFileRules(),
        ]);

        $assetData = collect($validated)
            ->except(['file', 'thumbnail'])
            ->toArray();

        $oldPaths = array_values(array_filter([
            $asset->file_path,
            $asset->thumbnail_path,
        ]));

        if ($request->hasFile('file')) {
            $type = $validated['asset_type'] ?? $asset->asset_type;
            $storedFile = $this->storeUploadedFile(
                $request->file('file'),
                "designer/{$type}s"
            );

            $assetData['file_path'] = $storedFile['path'];
            $assetData['file_url'] = $storedFile['url'];
            $assetData = $this->addSourceMetadata(
                $assetData,
                $storedFile['extension'],
                is_array($asset->metadata) ? $asset->metadata : []
            );

            if (!$request->hasFile('thumbnail')) {
                $autoThumb = $this->resolveThumbnailForAsset($storedFile, $validated['name'] ?? $asset->name);
                if ($autoThumb) {
                    $assetData['thumbnail_path'] = $autoThumb['path'];
                    $assetData['thumbnail_url'] = $autoThumb['url'];
                } elseif ($asset->thumbnail_path === $asset->file_path) {
                    // Do not leave the thumbnail pointing to the replaced file.
                    $assetData['thumbnail_path'] = null;
                    $assetData['thumbnail_url'] = null;
                }
            }
        }

        if ($request->hasFile('thumbnail')) {
            $storedThumbnail = $this->storeUploadedFile(
                $request->file('thumbnail'),
                'designer/thumbnails'
            );

            $assetData['thumbnail_path'] = $storedThumbnail['path'];
            $assetData['thumbnail_url'] = $storedThumbnail['url'];
        }

        $asset->update($assetData);
        $asset->refresh();
        $asset->load('category');

        $this->deletePathsNoLongerUsed($oldPaths, $asset);

        return response()->json([
            'success' => true,
            'message' => 'Asset updated successfully.',
            'data' => $asset,
        ]);
    }

    public function destroy(DesignAsset $asset): JsonResponse
    {
        $paths = array_unique(array_values(array_filter([
            $asset->file_path,
            $asset->thumbnail_path,
        ])));

        $asset->delete();

        foreach ($paths as $path) {
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Asset deleted successfully.',
        ]);
    }

    /**
     * Convert string values sent through multipart/form-data.
     */
    private function coerceFormDataFields(Request $request): void
    {
        foreach (['fabric_json', 'metadata'] as $field) {
            if ($request->has($field) && is_string($request->input($field))) {
                $decoded = json_decode($request->input($field), true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    $request->merge([$field => $decoded]);
                }
            }
        }

        if ($request->has('is_active')) {
            $boolean = filter_var(
                $request->input('is_active'),
                FILTER_VALIDATE_BOOLEAN,
                FILTER_NULL_ON_FAILURE
            );

            if ($boolean !== null) {
                $request->merge(['is_active' => $boolean]);
            }
        }

        if ($request->has('sort_order')) {
            $request->merge([
                'sort_order' => (int) $request->input('sort_order'),
            ]);
        }
    }

    private function assetFileRules(): array
    {
        return [
            'nullable',
            'file',
            'max:51200', // 50 MB
            $this->extensionRule(
                self::ALLOWED_ASSET_EXTENSIONS,
                'The asset must be JPG, JPEG, PNG, WebP, AVIF, GIF, SVG, BMP, TIFF, PSD, AI, EPS or PDF.'
            ),
        ];
    }

    private function thumbnailFileRules(): array
    {
        return [
            'nullable',
            'file',
            'max:5120', // 5 MB
            $this->extensionRule(
                self::ALLOWED_THUMBNAIL_EXTENSIONS,
                'The thumbnail must be JPG, JPEG, PNG, WebP or AVIF.'
            ),
        ];
    }

    private function extensionRule(array $allowed, string $message): Closure
    {
        return static function (
            string $attribute,
            mixed $value,
            Closure $fail
        ) use ($allowed, $message): void {
            if (!$value instanceof UploadedFile) {
                return;
            }

            $extension = strtolower($value->getClientOriginalExtension());

            if (!in_array($extension, $allowed, true)) {
                $fail($message);
            }
        };
    }

    /**
     * @return array{path: string, url: string, extension: string}
     */
    private function storeUploadedFile(
        UploadedFile $file,
        string $directory
    ): array {
        $extension = strtolower($file->getClientOriginalExtension());
        $filename = Str::uuid() . '.' . $extension;

        $path = $file->storeAs($directory, $filename, 'public');

        if (!$path) {
            throw ValidationException::withMessages([
                'file' => ['The uploaded file could not be stored.'],
            ]);
        }

        if ($extension === 'svg') {
            $this->sanitizeSvg($path);
        }

        return [
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'extension' => $extension,
        ];
    }

    private function addSourceMetadata(
        array $assetData,
        string $extension,
        array $existingMetadata = []
    ): array {
        $metadata = array_key_exists('metadata', $assetData)
            ? ($assetData['metadata'] ?? [])
            : $existingMetadata;

        $metadata['source_extension'] = $extension;
        $metadata['requires_conversion'] = $this->requiresConversion($extension);

        $assetData['metadata'] = $metadata;

        return $assetData;
    }

    private function requiresConversion(string $extension): bool
    {
        return in_array(
            strtolower($extension),
            self::FORMATS_REQUIRING_CONVERSION,
            true
        );
    }

    private function requiresConversionFromAsset(DesignAsset $asset): bool
    {
        return (bool) data_get($asset->metadata, 'requires_conversion', false);
    }

    private function deletePathsNoLongerUsed(
        array $oldPaths,
        DesignAsset $asset
    ): void {
        $currentPaths = array_values(array_filter([
            $asset->file_path,
            $asset->thumbnail_path,
        ]));

        foreach (array_unique($oldPaths) as $oldPath) {
            if (
                !in_array($oldPath, $currentPaths, true)
                && Storage::disk('public')->exists($oldPath)
            ) {
                Storage::disk('public')->delete($oldPath);
            }
        }
    }

    private function sanitizeSvg(string $filePath): void
    {
        if (!Storage::disk('public')->exists($filePath)) {
            return;
        }

        $content = Storage::disk('public')->get($filePath);

        // Remove executable and externally loaded SVG content.
        $cleanContent = preg_replace([
            '/<!DOCTYPE[^>]*>/is',
            '/<!ENTITY[^>]*>/is',
            '/<script\b[^>]*>.*?<\/script>/is',
            '/<foreignObject\b[^>]*>.*?<\/foreignObject>/is',
            '/\son[a-z]+\s*=\s*"[^"]*"/i',
            "/\son[a-z]+\s*=\s*'[^']*'/i",
            '/\son[a-z]+\s*=\s*[^\s>]+/i',
            '/(?:href|xlink:href)\s*=\s*"\s*javascript:[^"]*"/i',
            "/(?:href|xlink:href)\s*=\s*'\s*javascript:[^']*'/i",
        ], '', $content);

        if ($cleanContent === null) {
            Storage::disk('public')->delete($filePath);

            throw ValidationException::withMessages([
                'file' => ['The SVG file could not be sanitized.'],
            ]);
        }

        Storage::disk('public')->put($filePath, $cleanContent);
    }

    /**
     * Resolve or generate a web-renderable thumbnail for an uploaded asset.
     * Returns ['path' => string, 'url' => string] or null.
     *
     * @param array{path: string, url: string, extension: string} $storedFile
     * @return array{path: string, url: string}|null
     */
    private function resolveThumbnailForAsset(array $storedFile, ?string $assetName = null): ?array
    {
        $extension = strtolower($storedFile['extension']);

        // Web-renderable formats (jpg, png, webp, svg, gif, avif) serve directly as thumbnail
        if (!$this->requiresConversion($extension)) {
            return [
                'path' => $storedFile['path'],
                'url' => $storedFile['url'],
            ];
        }

        // For TIF/TIFF: convert first page to PNG via Imagick
        if (in_array($extension, ['tif', 'tiff'], true)) {
            try {
                if (class_exists(\Imagick::class)) {
                    $im = new \Imagick();
                    $fullPath = Storage::disk('public')->path($storedFile['path']);
                    $im->readImage($fullPath . '[0]');
                    $im->setImageFormat('png');
                    $im->thumbnailImage(400, 400, true);
                    $thumbName = 'designer/thumbnails/' . Str::uuid() . '.png';
                    Storage::disk('public')->put($thumbName, $im->getImageBlob());
                    $im->clear();
                    $im->destroy();

                    return [
                        'path' => $thumbName,
                        'url' => Storage::disk('public')->url($thumbName),
                    ];
                }
            } catch (\Throwable $e) {
                // Fallback to SVG badge preview if Imagick conversion encounters an issue
            }
        }

        // For PDF (or if TIFF conversion failed): generate a crisp SVG card thumbnail
        $badgeText = strtoupper($extension);
        $badgeColor = $extension === 'pdf' ? '#DC2626' : '#2563EB';
        $badgeBg = $extension === 'pdf' ? '#FEE2E2' : '#DBEAFE';
        $displayTitle = htmlspecialchars($assetName ?? $badgeText, ENT_QUOTES, 'UTF-8');

        $svgContent = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
    <rect width="400" height="400" rx="16" fill="{$badgeBg}"/>
    <path d="M140 90H220L280 150V310H140V90Z" fill="white" stroke="{$badgeColor}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M220 90V150H280" fill="white" stroke="{$badgeColor}" stroke-width="8" stroke-linejoin="round"/>
    <rect x="155" y="210" width="90" height="38" rx="8" fill="{$badgeColor}"/>
    <text x="200" y="235" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="16" fill="white">{$badgeText}</text>
    <text x="200" y="350" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#4B5563">{$displayTitle}</text>
</svg>
SVG;

        $thumbName = 'designer/thumbnails/' . Str::uuid() . '.svg';
        Storage::disk('public')->put($thumbName, $svgContent);

        return [
            'path' => $thumbName,
            'url' => Storage::disk('public')->url($thumbName),
        ];
    }
}

