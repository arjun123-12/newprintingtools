<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use App\Services\Freepik\FreepikIconService;
use Illuminate\Http\Request;

class IconSearchController extends Controller
{
    protected FreepikIconService $freepikIconService;

    public function __construct(FreepikIconService $freepikIconService)
    {
        $this->freepikIconService = $freepikIconService;
    }

    /**
     * Handle the incoming search request for icons.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function __invoke(Request $request)
    {
        try {
            $params = $request->only(['q', 'page', 'limit']);
            
            // Set defaults if not provided
            $params['page'] = $params['page'] ?? 1;
            $params['limit'] = $params['limit'] ?? 20;

            $result = $this->freepikIconService->searchIcons($params);

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to search Freepik icons: ' . $e->getMessage(),
            ], 500);
        }
    }
}
