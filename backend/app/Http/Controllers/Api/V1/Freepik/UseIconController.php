<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use App\Services\Freepik\FreepikIconService;
use Illuminate\Http\Request;

class UseIconController extends Controller
{
    protected FreepikIconService $freepikIconService;

    public function __construct(FreepikIconService $freepikIconService)
    {
        $this->freepikIconService = $freepikIconService;
    }

    /**
     * Handle the incoming request to use/download an icon.
     *
     * @param \Illuminate\Http\Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function __invoke(Request $request, string $id)
    {
        try {
            $result = $this->freepikIconService->useIcon($id);

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to use Freepik icon: ' . $e->getMessage(),
            ], 500);
        }
    }
}
