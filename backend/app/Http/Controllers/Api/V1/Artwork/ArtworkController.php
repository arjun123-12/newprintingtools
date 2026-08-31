<?php

namespace App\Http\Controllers\Api\V1\Artwork;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Services\Artwork\ArtworkStorageService;
use App\Services\Artwork\ArtworkValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ArtworkController extends Controller
{
    public function __construct(
        protected ArtworkStorageService $storageService,
        protected ArtworkValidationService $validationService
    ) {}

    /**
     * Return the authenticated user's saved designs.
     */
    public function index(Request $request): JsonResponse
    {
        $artworks = Artwork::query()
            ->where('user_id', $request->user()->id)
            ->where('source_type', 'designer')
            ->when(
                $request->filled('product_id'),
                fn ($query) => $query->where(
                    'product_id',
                    $request->string('product_id')
                )
            )
            ->latest('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $artworks,
        ]);
    }

    /**
     * Save a new Fabric.js design.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'required',
                'uuid',
                Rule::exists('products', 'id'),
            ],

            'design_template_id' => [
                'nullable',
                'uuid',
                Rule::exists('design_templates', 'id'),
            ],

            'name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'canvas_json' => [
                'required',
                'array',
            ],

            'document_settings' => [
                'nullable',
                'array',
            ],

            'width_px' => [
                'required',
                'integer',
                'min:1',
                'max:30000',
            ],

            'height_px' => [
                'required',
                'integer',
                'min:1',
                'max:30000',
            ],

            'dpi' => [
                'nullable',
                'integer',
                'min:72',
                'max:1200',
            ],

            'thumbnail_url' => [
                'nullable',
                'string',
                'max:2048',
            ],

            'customer_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        // Prevent using a template belonging to another product.
        if (!empty($validated['design_template_id'])) {
            $templateMatchesProduct = \App\Models\DesignTemplate::query()
                ->whereKey($validated['design_template_id'])
                ->where('product_id', $validated['product_id'])
                ->exists();

            if (!$templateMatchesProduct) {
                throw ValidationException::withMessages([
                    'design_template_id' => [
                        'The selected template does not belong to this product.',
                    ],
                ]);
            }
        }

        $artwork = Artwork::create([
            'user_id' => $request->user()->id,
            'product_id' => $validated['product_id'],
            'design_template_id' => $validated['design_template_id'] ?? null,
            'name' => $validated['name'] ?? 'Untitled Design',

            'source_type' => 'designer',
            'design_status' => 'draft',

            'canvas_json' => $validated['canvas_json'],
            'document_settings' => $validated['document_settings'] ?? null,
            'width_px' => $validated['width_px'],
            'height_px' => $validated['height_px'],
            'dpi' => $validated['dpi'] ?? 300,

            'thumbnail_url' => $validated['thumbnail_url'] ?? null,
            'customer_notes' => $validated['customer_notes'] ?? null,

            // Always use the currently configured storage provider.
            'storage_disk' => config('filesystems.default', 'public'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artwork draft created successfully.',
            'data' => $artwork,
        ], 201);
    }

    /**
     * Return one saved design.
     */
    public function show(Request $request, Artwork $artwork): JsonResponse
    {
        $this->ensureOwner($request, $artwork);

        $artwork->load([
            'product',
            'designTemplate',
        ]);

        return response()->json([
            'success' => true,
            'data' => $artwork,
        ]);
    }

    /**
     * Autosave or update an existing design.
     */
    public function update(
        Request $request,
        Artwork $artwork
    ): JsonResponse {
        $this->ensureOwner($request, $artwork);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:255',
            ],

            'canvas_json' => [
                'sometimes',
                'array',
            ],

            'document_settings' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'width_px' => [
                'sometimes',
                'integer',
                'min:1',
                'max:30000',
            ],

            'height_px' => [
                'sometimes',
                'integer',
                'min:1',
                'max:30000',
            ],

            'dpi' => [
                'sometimes',
                'integer',
                'min:72',
                'max:1200',
            ],

            'thumbnail_url' => [
                'sometimes',
                'nullable',
                'string',
                'max:2048',
            ],

            'customer_notes' => [
                'sometimes',
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $artwork->fill($validated);
        $artwork->save();

        return response()->json([
            'success' => true,
            'message' => 'Artwork saved successfully.',
            'data' => $artwork->fresh(),
        ]);
    }

    /**
     * Mark a design as completed.
     */
    public function complete(
        Request $request,
        Artwork $artwork
    ): JsonResponse {
        $this->ensureOwner($request, $artwork);

        if (empty($artwork->canvas_json)) {
            throw ValidationException::withMessages([
                'canvas_json' => [
                    'The artwork canvas is empty.',
                ],
            ]);
        }

        $artwork->update([
            'design_status' => 'completed',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artwork completed successfully.',
            'data' => $artwork->fresh(),
        ]);
    }

    /**
     * Delete a draft.
     */
    public function destroy(
        Request $request,
        Artwork $artwork
    ): JsonResponse {
        $this->ensureOwner($request, $artwork);

        if ($artwork->design_status === 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Completed artwork cannot be deleted.',
            ], 422);
        }

        $artwork->delete();

        return response()->json([
            'success' => true,
            'message' => 'Artwork draft deleted successfully.',
        ]);
    }

    /**
     * Generate a direct-upload URL.
     */
    public function presign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_name' => [
                'required',
                'string',
                'max:255',
            ],

            'mime_type' => [
                'required',
                'string',
                'max:100',
            ],
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

    /**
     * Run print preflight verification.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_path' => [
                'required',
                'string',
                'max:2048',
            ],

            'width_mm' => [
                'required',
                'numeric',
                'min:1',
            ],

            'height_mm' => [
                'required',
                'numeric',
                'min:1',
            ],
        ]);

        $checkResult = $this->validationService->preflightCheck(
            $validated['file_path'],
            [
                'width_mm' => $validated['width_mm'],
                'height_mm' => $validated['height_mm'],
            ]
        );

        return response()->json([
            'success' => true,
            'data' => $checkResult,
        ]);
    }

    /**
     * Ensure customers can only access their own designs.
     */
    private function ensureOwner(
        Request $request,
        Artwork $artwork
    ): void {
        abort_unless(
            (int) $artwork->user_id === (int) $request->user()->id,
            403,
            'You do not have permission to access this artwork.'
        );
    }
}