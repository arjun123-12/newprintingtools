<?php

namespace App\Http\Controllers\Api\V1\Artwork;

use App\Http\Controllers\Controller;
use App\Services\Artwork\ArtworkStorageService;
use App\Services\Artwork\ArtworkValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArtworkController extends Controller
{
    public function __construct(
        protected ArtworkStorageService $storageService,
        protected ArtworkValidationService $validationService
    ) {}

    public function presign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_name' => 'required|string',
            'mime_type' => 'required|string',
        ]);

        $result = $this->storageService->generatePresignedUploadUrl(
            $validated['file_name'],
            $validated['mime_type']
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_path' => 'required|string',
            'width_mm' => 'required|numeric',
            'height_mm' => 'required|numeric',
        ]);

        $checkResult = $this->validationService->preflightCheck(
            $validated['file_path'],
            ['width_mm' => $validated['width_mm'], 'height_mm' => $validated['height_mm']]
        );

        return response()->json([
            'success' => true,
            'data' => $checkResult,
        ]);
    }
}
