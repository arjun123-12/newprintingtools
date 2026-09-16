<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use App\Services\Freepik\FreepikDownloadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class UseAssetController extends Controller
{
    public function __construct(
        protected FreepikDownloadService $freepikDownloadService
    ) {
    }

    /**
     * Download and permanently store a Freepik asset.
     *
     * Supported request formats:
     * - psd
     * - photo
     * - vector
     */
    public function __invoke(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'format' => [
                'nullable',
                'string',
                'in:psd,photo,vector',
            ],
        ]);

        try {
            $data = $this->freepikDownloadService->useAsset(
                $id,
                $validated['format'] ?? null
            );

            return response()->json([
                'success' => true,
                'message' => ($validated['format'] ?? null) === 'psd'
                    ? 'PSD downloaded successfully.'
                    : 'Freepik asset downloaded successfully.',
                'data' => $data,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            $status = (int) $exception->getCode();

            // Exception codes are not always valid HTTP status codes.
            if ($status < 400 || $status > 599) {
                $status = 500;
            }

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], $status);
        }
    }
}