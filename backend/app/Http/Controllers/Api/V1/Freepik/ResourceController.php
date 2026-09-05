<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use App\Services\Freepik\FreepikResourceService;

class ResourceController extends Controller
{
    protected FreepikResourceService $freepikResourceService;

    public function __construct(FreepikResourceService $freepikResourceService)
    {
        $this->freepikResourceService = $freepikResourceService;
    }

    /**
     * Get Freepik resource details.
     */
    public function __invoke(string $id): JsonResponse
    {
        try {
            $data = $this->freepikResourceService->getDetails($id);

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
