<?php

namespace App\Http\Controllers\Api\V1\Public\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignAsset;
use App\Models\DesignAssetCategory;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DesignAssetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DesignAsset::with('category')->where('is_active', true);

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        
        if ($request->filled('asset_type') && $request->asset_type !== 'all') {
            $types = array_filter(explode(',', (string) $request->asset_type));
            if (count($types) > 1) {
                $query->whereIn('asset_type', $types);
            } elseif (count($types) === 1) {
                $query->where('asset_type', reset($types));
            }
        }

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $perPage = $request->input('per_page', 24);
        
        // Sorting
        $sort = $request->input('sort', 'sort_order');
        if ($sort === 'newest') {
            $query->orderBy('created_at', 'desc');
        } elseif ($sort === 'oldest') {
            $query->orderBy('created_at', 'asc');
        } else {
            $query->orderBy('sort_order', 'asc')->orderBy('created_at', 'desc');
        }

        $assets = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $assets,
        ]);
    }

    public function show(DesignAsset $asset): JsonResponse
    {
        if (!$asset->is_active) {
            return response()->json(['success' => false, 'message' => 'Asset not found or inactive.'], 404);
        }
        
        $asset->load('category');
        return response()->json([
            'success' => true,
            'data' => $asset,
        ]);
    }

    public function categories(Request $request): JsonResponse
    {
        $query = DesignAssetCategory::where('is_active', true);

        if ($request->has('asset_type')) {
            $query->where('asset_type', $request->asset_type);
        }

        $categories = $query->orderBy('sort_order')->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }
}
