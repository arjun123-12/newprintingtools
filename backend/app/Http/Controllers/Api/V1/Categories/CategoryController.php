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
    public function adminIndex(): JsonResponse
    {
        $categories = Category::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

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
     * Delete a category only when no products use it.
     */
    public function destroy(string $id): JsonResponse
    {
        $category = Category::findOrFail($id);

        $hasProducts = DB::table('products')
            ->where('category_id', $category->id)
            ->exists();

        if ($hasProducts) {
            return response()->json([
                'success' => false,
                'message' => 'This category still has products. Reassign them before deleting the category.',
            ], 409);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully',
        ]);
    }

    /**
     * Delete multiple categories only when none are used by products.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        $ids = array_values(array_unique($validated['ids']));

        $categoriesInUse = DB::table('products')
            ->whereIn('category_id', $ids)
            ->distinct()
            ->pluck('category_id');

        if ($categoriesInUse->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Some selected categories still have products. Reassign those products before deleting.',
                'categories_in_use' => $categoriesInUse,
            ], 409);
        }

        $count = Category::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} category(ies) deleted successfully.",
            'deleted_count' => $count,
        ]);
    }
}