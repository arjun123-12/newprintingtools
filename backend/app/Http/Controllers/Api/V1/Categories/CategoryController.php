<?php

namespace App\Http\Controllers\Api\V1\Categories;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    /**
     * Public category listing.
     * Only active categories are returned to customers.
     */
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Admin category listing.
     * Active and inactive categories are returned for management.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $query = Category::query();

        if ($request->query('status') === 'archived' || $request->boolean('archived')) {
            $query->onlyTrashed()->orderByDesc('deleted_at');
        } else {
            $query->orderBy('sort_order')->orderBy('name');
        }

        $categories = $query->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Store a category submitted by the Next.js admin form.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:categories,name',
            ],
            'slug' => [
                'required',
                'string',
                'max:255',
                'alpha_dash',
                'unique:categories,slug',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'parent_id' => [
                'nullable',
                'uuid',
                'exists:categories,id',
            ],
            'image_url' => [
                'nullable',
                'url',
                'max:255',
            ],
            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
            'is_active' => [
                'nullable',
                'boolean',
            ],
        ]);

        $category = new Category();
        $category->id = (string) Str::uuid();
        $category->parent_id = $validated['parent_id'] ?? null;
        $category->name = $validated['name'];
        $category->slug = $validated['slug'];
        $category->description = $validated['description'] ?? null;
        $category->image_url = $validated['image_url'] ?? null;
        $category->sort_order = $validated['sort_order'] ?? 0;
        $category->is_active = $validated['is_active'] ?? true;
        $category->save();

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully',
            'data' => $category,
        ], 201);
    }

    /**
     * Public category details by slug.
     */
    public function show(string $slug): JsonResponse
    {
        $category = Category::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $category,
        ]);
    }

    /**
     * Update a category.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:categories,name,' . $category->id,
            'slug' => 'sometimes|required|string|max:255|alpha_dash|unique:categories,slug,' . $category->id,
            'description' => 'nullable|string',
            'parent_id' => 'nullable|uuid|exists:categories,id',
            'image_url' => 'nullable|string|max:500',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $category->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully',
            'data' => $category,
        ]);
    }

    /**
     * Get archived (soft-deleted) categories.
     */
    public function archived(): JsonResponse
    {
        $categories = Category::onlyTrashed()
            ->orderByDesc('deleted_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Archive (soft-delete) a category.
     * Existing products referencing this category remain completely intact.
     */
    public function destroy(string $id): JsonResponse
    {
        $category = Category::withTrashed()->find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        if ($category->trashed()) {
            return response()->json([
                'success' => false,
                'message' => 'Category is already archived.',
            ], 409);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category moved to archive successfully.',
        ]);
    }

    /**
     * Bulk archive (soft-delete) categories.
     * Existing products referencing these categories remain completely intact.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $ids = array_values(array_unique($validated['ids']));

        $count = Category::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} category(ies) moved to archive successfully.",
            'archived_count' => $count,
            'deleted_count' => $count,
        ]);
    }

    /**
     * Restore a soft-deleted category.
     */
    public function restore(string $id): JsonResponse
    {
        $category = Category::withTrashed()->find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        if (!$category->trashed()) {
            return response()->json([
                'success' => false,
                'message' => 'Category is not archived.',
            ], 409);
        }

        $category->restore();

        return response()->json([
            'success' => true,
            'message' => 'Category restored successfully.',
            'data' => $category,
        ]);
    }

    /**
     * Bulk restore soft-deleted categories.
     */
    public function bulkRestore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $ids = array_values(array_unique($validated['ids']));

        $count = Category::onlyTrashed()->whereIn('id', $ids)->restore();

        return response()->json([
            'success' => true,
            'message' => "{$count} category(ies) restored successfully.",
            'restored_count' => $count,
        ]);
    }
}