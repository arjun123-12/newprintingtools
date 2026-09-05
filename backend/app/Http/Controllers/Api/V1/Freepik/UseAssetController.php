<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use App\Services\Freepik\FreepikDownloadService;

class UseAssetController extends Controller
{
    protected FreepikDownloadService $freepikDownloadService;

    public function __construct(FreepikDownloadService $freepikDownloadService)
    {
        $this->freepikDownloadService = $freepikDownloadService;
    }

    /**
     * Use/Download a Freepik asset.
     */
    public function __invoke(string $id): JsonResponse
    {
        try {
            $data = $this->freepikDownloadService->useAsset($id);

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
