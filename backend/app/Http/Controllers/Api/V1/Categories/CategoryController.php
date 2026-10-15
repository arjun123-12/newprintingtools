<?php

namespace App\Http\Controllers\Api\V1\Categories;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\DesignTemplate;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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
        if (empty($request->slug) && !empty($request->name)) {
            $baseSlug = Str::slug($request->name);
            $candidate = $baseSlug ?: 'category';
            $counter = 1;
            while (Category::where('slug', $candidate)->exists()) {
                $candidate = $baseSlug . '-' . $counter++;
            }
            $request->merge(['slug' => $candidate]);
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:categories,name',
            ],
            'slug' => [
                'nullable',
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
     */
    public function archive(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

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
     */
    public function bulkArchive(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

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
     * Permanently delete a category (or archive if requested).
     * Prevents deletion if products or child subcategories are assigned to it.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $category = Category::withTrashed()->find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        if ($request->boolean('archive')) {
            return $this->archive($request, $id);
        }

        // Check if products exist in that category (including soft-deleted products and multi-category assignments)
        $productsCount = Product::withTrashed()
            ->where(function ($q) use ($category) {
                $q->where('category_id', $category->id)
                    ->orWhereHas('categories', fn ($cq) => $cq->where('categories.id', $category->id));
            })->count();
        if ($productsCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete category '{$category->name}' because {$productsCount} product(s) are assigned to it. Please move or delete those products first.",
            ], 422);
        }

        // Check if templates exist in that category
        $templatesCount = DesignTemplate::whereHas('categories', fn ($q) => $q->where('categories.id', $category->id))->count();
        if ($templatesCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete category '{$category->name}' because {$templatesCount} template(s) are assigned to it. Please move or delete those templates first.",
            ], 422);
        }

        // Check if child categories exist
        $childrenCount = Category::withTrashed()->where('parent_id', $category->id)->count();
        if ($childrenCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete category '{$category->name}' because {$childrenCount} subcategory(ies) exist under it. Please reassign or delete the subcategories first.",
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Delete uploaded category image if stored locally
            if (!empty($category->image_url) && str_contains($category->image_url, '/storage/categories/')) {
                $path = str_replace(Storage::disk('public')->url(''), '', $category->image_url);
                $path = ltrim($path, '/');
                if (Storage::disk('public')->exists($path)) {
                    Storage::disk('public')->delete($path);
                }
            }

            $category->forceDelete();
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Category permanently deleted successfully.',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Failed to permanently delete category {$id}: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to permanently delete category: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Bulk permanently delete categories (or bulk archive if requested).
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && method_exists($user, 'isAdmin') && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
            'archive' => ['nullable', 'boolean'],
        ]);

        $ids = array_values(array_unique($validated['ids']));

        if ($request->boolean('archive')) {
            return $this->bulkArchive($request);
        }

        // Check all selected categories for products or child categories
        $categories = Category::withTrashed()->whereIn('id', $ids)->get();

        foreach ($categories as $category) {
            $pCount = Product::withTrashed()
                ->where(function ($q) use ($category) {
                    $q->where('category_id', $category->id)
                        ->orWhereHas('categories', fn ($cq) => $cq->where('categories.id', $category->id));
                })->count();
            if ($pCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot delete category '{$category->name}' because {$pCount} product(s) are assigned to it. Please move or delete those products first.",
                ], 422);
            }

            $tCount = DesignTemplate::whereHas('categories', fn ($q) => $q->where('categories.id', $category->id))->count();
            if ($tCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot delete category '{$category->name}' because {$tCount} template(s) are assigned to it. Please move or delete those templates first.",
                ], 422);
            }

            $cCount = Category::withTrashed()->where('parent_id', $category->id)->count();
            if ($cCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot delete category '{$category->name}' because {$cCount} subcategory(ies) exist under it. Please reassign or delete the subcategories first.",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $deletedCount = 0;
            foreach ($categories as $category) {
                if (!empty($category->image_url) && str_contains($category->image_url, '/storage/categories/')) {
                    $path = str_replace(Storage::disk('public')->url(''), '', $category->image_url);
                    $path = ltrim($path, '/');
                    if (Storage::disk('public')->exists($path)) {
                        Storage::disk('public')->delete($path);
                    }
                }
                $category->forceDelete();
                $deletedCount++;
            }
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$deletedCount} category(ies) permanently deleted successfully.",
                'deleted_count' => $deletedCount,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Failed bulk permanent delete of categories: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to permanently delete categories: ' . $e->getMessage(),
            ], 500);
        }
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