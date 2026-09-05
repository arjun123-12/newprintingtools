<?php

namespace App\Http\Controllers\Api\V1\Freepik;

use App\Http\Controllers\Controller;
use App\Services\Freepik\FreepikDownloadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class RemoveBackgroundController extends Controller
{
    public function __construct(
        protected FreepikDownloadService $freepikDownloadService
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'image_url' => [
                'required',
                'url',
                'max:2048',
            ],
        ]);

        try {
            $data =
                $this->freepikDownloadService
                    ->removeBackground(
                        $validated['image_url']
                    );

            return response()->json([
                'success' => true,
                'message' => 'Background removed successfully.',
                'data' => $data,
            ]);
        } catch (Throwable $exception) {
            $status = (int) $exception->getCode();

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