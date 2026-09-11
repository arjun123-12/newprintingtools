<?php

namespace App\Http\Controllers\Api\V1\Admin\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignAssetCategory;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DesignAssetCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DesignAssetCategory::query();

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        
        if ($request->has('asset_type')) {
            $query->where('asset_type', $request->asset_type);
        }

        $categories = $query->orderBy('sort_order')->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->coerceFormDataFields($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:design_asset_categories,slug',
            'asset_type' => 'required|string|in:text,frame,photo,element,background,shape',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $category = DesignAssetCategory::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data' => $category,
        ], 201);
    }

    public function show(DesignAssetCategory $assetCategory): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $assetCategory,
        ]);
    }

    public function update(Request $request, DesignAssetCategory $assetCategory): JsonResponse
    {
        $this->coerceFormDataFields($request);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:255|unique:design_asset_categories,slug,' . $assetCategory->id,
            'asset_type' => 'sometimes|required|string|in:text,frame,photo,element,background,shape',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $assetCategory->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data' => $assetCategory,
        ]);
    }

    public function destroy(DesignAssetCategory $assetCategory): JsonResponse
    {
        $assetCategory->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.',
        ]);
    }

    /**
     * Coerce string-encoded fields from multipart/form-data before validation.
     */
    private function coerceFormDataFields(Request $request): void
    {
        if ($request->has('is_active')) {
            $val = $request->input('is_active');
            if ($val === 'true') {
                $request->merge(['is_active' => true]);
            } elseif ($val === 'false') {
                $request->merge(['is_active' => false]);
            }
        }

        if ($request->has('sort_order')) {
            $request->merge(['sort_order' => (int) $request->input('sort_order')]);
        }
    }
}
