<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\Freepik\FreepikResourceService;

class SearchController extends Controller
{
    protected FreepikResourceService $freepikResourceService;

    public function __construct(FreepikResourceService $freepikResourceService)
    {
        $this->freepikResourceService = $freepikResourceService;
    }

    /**
     * Search Freepik resources.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'in:vector,photo,icon,psd,all'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $validated['q'] = $validated['q'] ?? '';

        try {
            $data = $this->freepikResourceService->search($validated);

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            $status = $e->getCode() > 0 ? $e->getCode() : 500;
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], $status);
        }
    }
}
