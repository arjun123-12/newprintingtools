<?php

namespace App\Http\Controllers\Api\V1\Admin\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignAsset;
use App\Models\DesignAssetCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DesignAssetController extends Controller
{
    private const ASSET_TYPES = [
        'text',
        'photo',
        'frame',
        'shape',
        'element',
        'background',
    ];

    /**
     * Display all design assets.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DesignAsset::query()
            ->with([
                'category:id,name,slug,asset_type,is_active,sort_order',
            ]);

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%");
            });
        }

        if ($request->filled('asset_type')) {
            $query->where(
                'asset_type',
                strtolower(trim((string) $request->input('asset_type')))
            );
        }

        if ($request->filled('category_id')) {
            $query->where(
                'category_id',
                $request->input('category_id')
            );
        }

        if ($request->has('is_active')) {
            $isActive = filter_var(
                $request->input('is_active'),
                FILTER_VALIDATE_BOOLEAN,
                FILTER_NULL_ON_FAILURE
            );

            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        $assets = $query
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $assets,
        ]);
    }

    /**
     * Store a new design asset.
     */
    public function store(Request $request): JsonResponse
    {
        $this->normalizeRequest($request);

        $validated = $request->validate([
            'category_id' => [
                'required',
                'string',
                Rule::exists('design_asset_categories', 'id'),
            ],

            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('design_assets', 'slug'),
            ],

            'asset_type' => [
                'required',
                'string',
                Rule::in(self::ASSET_TYPES),
            ],

            'file' => [
                'required_without:fabric_json',
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,webp,gif,svg,pdf,tif,tiff',
                'max:20480',
            ],

            'thumbnail' => [
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,webp,gif,svg',
                'max:5120',
            ],

            'fabric_json' => [
                'nullable',
                'array',
            ],

            'metadata' => [
                'nullable',
                'array',
            ],

            'provider' => [
                'nullable',
                'string',
                'max:100',
            ],

            'provider_asset_id' => [
                'nullable',
                'string',
                'max:255',
            ],

            'license_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'attribution' => [
                'nullable',
                'string',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            'sort_order' => [
                'sometimes',
                'integer',
                'min:0',
            ],
        ]);

        $category = $this->getAndValidateCategory(
            $validated['category_id'],
            $validated['asset_type']
        );

        $filePath = null;
        $thumbnailPath = null;

        try {
            if ($request->hasFile('file')) {
                $filePath = $request->file('file')->store(
                    $this->getStorageDirectory($validated['asset_type']),
                    'public'
                );
            }

            if ($request->hasFile('thumbnail')) {
                $thumbnailPath = $request->file('thumbnail')->store(
                    $this->getThumbnailDirectory($validated['asset_type']),
                    'public'
                );
            }

            $asset = DesignAsset::create([
                'category_id' => $category->id,
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'asset_type' => $validated['asset_type'],

                'file_path' => $filePath,
                'file_url' => $filePath
                    ? Storage::disk('public')->url($filePath)
                    : null,

                'thumbnail_path' => $thumbnailPath,
                'thumbnail_url' => $thumbnailPath
                    ? Storage::disk('public')->url($thumbnailPath)
                    : null,

                'fabric_json' => $validated['fabric_json'] ?? null,
                'metadata' => $validated['metadata'] ?? null,
              'provider' => $validated['provider'] ?? 'admin',
                'provider_asset_id' =>
                    $validated['provider_asset_id'] ?? null,
                'license_name' => $validated['license_name'] ?? null,
                'attribution' => $validated['attribution'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
                'sort_order' => $validated['sort_order'] ?? 0,
            ]);

            $asset->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Design asset created successfully.',
                'data' => $asset,
            ], 201);
        } catch (\Throwable $exception) {
            $this->deleteStoredFile($filePath);
            $this->deleteStoredFile($thumbnailPath);

            throw $exception;
        }
    }

    /**
     * Display one design asset.
     */
    public function show(DesignAsset $asset): JsonResponse
    {
        $asset->load('category');

        return response()->json([
            'success' => true,
            'data' => $asset,
        ]);
    }

    /**
     * Update a design asset.
     */
    public function update(
        Request $request,
        DesignAsset $asset
    ): JsonResponse {
        $this->normalizeRequest($request);

        $validated = $request->validate([
            'category_id' => [
                'required',
                'string',
                Rule::exists('design_asset_categories', 'id'),
            ],

            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('design_assets', 'slug')
                    ->ignore($asset->getKey()),
            ],

            'asset_type' => [
                'sometimes',
                'required',
                'string',
                Rule::in(self::ASSET_TYPES),
            ],

            'file' => [
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,webp,gif,svg,pdf,tif,tiff',
                'max:20480',
            ],

            'thumbnail' => [
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,webp,gif,svg',
                'max:5120',
            ],

            'fabric_json' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'metadata' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'provider' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
            ],

            'provider_asset_id' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'license_name' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'attribution' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            'sort_order' => [
                'sometimes',
                'integer',
                'min:0',
            ],
        ]);

        $assetType = $validated['asset_type']
            ?? $asset->asset_type;

        $categoryId = $validated['category_id']
            ?? $asset->category_id;

        $this->getAndValidateCategory(
            $categoryId,
            $assetType
        );

        $oldFilePath = $asset->file_path;
        $oldThumbnailPath = $asset->thumbnail_path;

        $newFilePath = null;
        $newThumbnailPath = null;

        try {
            if ($request->hasFile('file')) {
                $newFilePath = $request->file('file')->store(
                    $this->getStorageDirectory($assetType),
                    'public'
                );

                $validated['file_path'] = $newFilePath;
                $validated['file_url'] =
                    Storage::disk('public')->url($newFilePath);
            }

            if ($request->hasFile('thumbnail')) {
                $newThumbnailPath = $request
                    ->file('thumbnail')
                    ->store(
                        $this->getThumbnailDirectory($assetType),
                        'public'
                    );

                $validated['thumbnail_path'] = $newThumbnailPath;
                $validated['thumbnail_url'] =
                    Storage::disk('public')->url($newThumbnailPath);
            }

            unset($validated['file'], $validated['thumbnail']);

            $asset->update($validated);

            if ($newFilePath && $oldFilePath !== $newFilePath) {
                $this->deleteStoredFile($oldFilePath);
            }

            if (
                $newThumbnailPath &&
                $oldThumbnailPath !== $newThumbnailPath
            ) {
                $this->deleteStoredFile($oldThumbnailPath);
            }

            return response()->json([
                'success' => true,
                'message' => 'Design asset updated successfully.',
                'data' => $asset->fresh()->load('category'),
            ]);
        } catch (\Throwable $exception) {
            $this->deleteStoredFile($newFilePath);
            $this->deleteStoredFile($newThumbnailPath);

            throw $exception;
        }
    }

    /**
     * Delete one design asset.
     */
    public function destroy(DesignAsset $asset): JsonResponse
    {
        $filePath = $asset->file_path;
        $thumbnailPath = $asset->thumbnail_path;

        $asset->delete();

        $this->deleteStoredFile($filePath);
        $this->deleteStoredFile($thumbnailPath);

        return response()->json([
            'success' => true,
            'message' => 'Design asset deleted successfully.',
        ]);
    }

    /**
     * Delete multiple design assets.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => [
                'required',
                'array',
                'min:1',
            ],
            'ids.*' => [
                'required',
                'distinct',
                'string',
                Rule::exists('design_assets', 'id'),
            ],
        ]);

        $assets = DesignAsset::whereIn(
            'id',
            $validated['ids']
        )->get();

        $deletedCount = 0;

        foreach ($assets as $asset) {
            $filePath = $asset->file_path;
            $thumbnailPath = $asset->thumbnail_path;

            if ($asset->delete()) {
                $deletedCount++;

                $this->deleteStoredFile($filePath);
                $this->deleteStoredFile($thumbnailPath);
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$deletedCount} asset(s) deleted successfully.",
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Ensure the selected category exists, is active, and matches
     * the selected asset type.
     */
    private function getAndValidateCategory(
        string $categoryId,
        string $assetType
    ): DesignAssetCategory {
        $category = DesignAssetCategory::findOrFail($categoryId);

        if ($category->asset_type !== $assetType) {
            throw ValidationException::withMessages([
                'category_id' => [
                    "The selected category belongs to {$category->asset_type}, not {$assetType}.",
                ],
            ]);
        }

        if (!$category->is_active) {
            throw ValidationException::withMessages([
                'category_id' => [
                    'The selected asset category is inactive.',
                ],
            ]);
        }

        return $category;
    }

    /**
     * Normalize JSON and multipart/form-data request values.
     */
    private function normalizeRequest(Request $request): void
    {
        $normalized = [];

        if ($request->has('name')) {
            $normalized['name'] = trim(
                (string) $request->input('name')
            );
        }

        if ($request->has('slug')) {
            $normalized['slug'] = strtolower(
                trim((string) $request->input('slug'))
            );
        }

        if ($request->has('asset_type')) {
            $normalized['asset_type'] = strtolower(
                trim((string) $request->input('asset_type'))
            );
        }

        if ($request->has('category_id')) {
            $normalized['category_id'] = trim(
                (string) $request->input('category_id')
            );
        }

        foreach (['fabric_json', 'metadata'] as $jsonField) {
            if (!$request->has($jsonField)) {
                continue;
            }

            $value = $request->input($jsonField);

            if (is_string($value)) {
                $decoded = json_decode($value, true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    $normalized[$jsonField] = $decoded;
                }
            }
        }

        if ($request->has('is_active')) {
            $value = $request->input('is_active');

            if (is_bool($value)) {
                $normalized['is_active'] = $value;
            } elseif (in_array($value, ['true', '1', 1], true)) {
                $normalized['is_active'] = true;
            } elseif (in_array($value, ['false', '0', 0], true)) {
                $normalized['is_active'] = false;
            }
        }

        if ($request->has('sort_order')) {
            $normalized['sort_order'] =
                (int) $request->input('sort_order');
        }

        if ($normalized !== []) {
            $request->merge($normalized);
        }
    }

    /**
     * Get asset storage directory.
     */
    private function getStorageDirectory(
        string $assetType
    ): string {
        $folder = match ($assetType) {
            'photo' => 'photos',
            'frame' => 'frames',
            'shape' => 'shapes',
            'element' => 'elements',
            'background' => 'backgrounds',
            'text' => 'text',
            default => 'assets',
        };

        return "designer/{$folder}";
    }

    /**
     * Get thumbnail storage directory.
     */
    private function getThumbnailDirectory(
        string $assetType
    ): string {
        $folder = match ($assetType) {
            'photo' => 'photos',
            'frame' => 'frames',
            'shape' => 'shapes',
            'element' => 'elements',
            'background' => 'backgrounds',
            'text' => 'text',
            default => 'assets',
        };

        return "designer/{$folder}/thumbnails";
    }

    /**
     * Safely delete a file from public storage.
     */
    private function deleteStoredFile(?string $path): void
    {
        if (
            !empty($path) &&
            Storage::disk('public')->exists($path)
        ) {
            Storage::disk('public')->delete($path);
        }
    }
}
