<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\ExternalAssets\ExternalAssetAggregatorService;
use Illuminate\Support\Facades\Storage;

class ExternalAssetController extends Controller
{
    protected ExternalAssetAggregatorService $assetService;

    public function __construct(ExternalAssetAggregatorService $assetService)
    {
        $this->assetService = $assetService;
    }

    public function categories(): JsonResponse
    {
        try {
            $categories = $this->assetService->getCategories();
            return response()->json([
                'success' => true,
                'data' => $categories,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch categories: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function search(Request $request): JsonResponse
    {
        $params = $request->validate([
            'provider' => 'nullable|string|in:all,freepik,magnific',
            'query' => 'nullable|string|max:100',
            'category' => 'nullable|string|max:50',
            'asset_type' => 'nullable|string|max:50',
            'format' => 'nullable|string|max:20',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'sort' => 'nullable|string',
        ]);

        try {
            $results = $this->assetService->search($params);
            return response()->json($results);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Search failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function show(string $provider, string $id): JsonResponse
    {
        try {
            $details = $this->assetService->getAssetDetails($provider, $id);
            if (!$details) {
                return response()->json(['success' => false, 'message' => 'Asset not found'], 404);
            }
            return response()->json([
                'success' => true,
                'data' => $details,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch details: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function useAsset(Request $request, string $provider, string $id): JsonResponse
    {
        try {
            $useData = $this->assetService->getUseUrl($provider, $id);
            
            // At this point we could potentially download and store locally if the license permits.
            // For now, we will return the usable URL.
            
            return response()->json([
                'success' => true,
                'data' => [
                    'url' => $useData['url'],
                    'metadata' => $useData['metadata'] ?? [],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to use asset: ' . $e->getMessage(),
            ], 500);
        }
    }
}
