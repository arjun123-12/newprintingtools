<?php

namespace App\Http\Controllers\Api\V1\Admin\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignAssetCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DesignAssetCategoryController extends Controller
{
    /**
     * Asset types supported by the designer.
     */
    private const ASSET_TYPES = [
        'text',
        'photo',
        'frame',
        'shape',
        'element',
        'background',
    ];

    /**
     * Display all asset categories.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DesignAssetCategory::query();

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('asset_type')) {
            $query->where(
                'asset_type',
                strtolower(trim((string) $request->input('asset_type')))
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

        $categories = $query
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Create an asset category.
     */
    public function store(Request $request): JsonResponse
    {
        $this->normalizeRequest($request);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('design_asset_categories', 'slug'),
            ],
            'asset_type' => [
                'required',
                'string',
                Rule::in(self::ASSET_TYPES),
            ],
            'description' => [
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

        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['sort_order'] = $validated['sort_order'] ?? 0;

        $category = DesignAssetCategory::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data' => $category,
        ], 201);
    }

    /**
     * Display one asset category.
     */
    public function show(
        DesignAssetCategory $assetCategory
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'data' => $assetCategory,
        ]);
    }

    /**
     * Update an asset category.
     */
    public function update(
        Request $request,
        DesignAssetCategory $assetCategory
    ): JsonResponse {
        $this->normalizeRequest($request);

        $validated = $request->validate([
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
                Rule::unique('design_asset_categories', 'slug')
                    ->ignore($assetCategory->getKey()),
            ],
            'asset_type' => [
                'sometimes',
                'required',
                'string',
                Rule::in(self::ASSET_TYPES),
            ],
            'description' => [
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

        $assetCategory->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data' => $assetCategory->fresh(),
        ]);
    }

    /**
     * Delete an asset category.
     */
    public function destroy(
        DesignAssetCategory $assetCategory
    ): JsonResponse {
        $assetCategory->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.',
        ]);
    }

    /**
     * Delete multiple asset categories.
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
                Rule::exists('design_asset_categories', 'id'),
            ],
        ]);

        $deletedCount = DesignAssetCategory::whereIn(
            'id',
            $validated['ids']
        )->delete();

        return response()->json([
            'success' => true,
            'message' => "{$deletedCount} category(ies) deleted successfully.",
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Normalize JSON and multipart/form-data values before validation.
     */
    private function normalizeRequest(Request $request): void
    {
        $normalized = [];

        if ($request->has('name')) {
            $normalized['name'] = trim((string) $request->input('name'));
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

        if ($request->has('description')) {
            $description = trim(
                (string) $request->input('description')
            );

            $normalized['description'] = $description !== ''
                ? $description
                : null;
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
            $normalized['sort_order'] = (int) $request->input('sort_order');
        }

        if ($normalized !== []) {
            $request->merge($normalized);
        }
    }
}