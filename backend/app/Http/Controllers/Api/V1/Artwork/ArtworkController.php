<?php

namespace App\Http\Controllers\Api\V1\Artwork;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\DesignTemplate;
use App\Services\Artwork\ArtworkStorageService;
use App\Services\Artwork\ArtworkValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ArtworkController extends Controller
{
    public function __construct(
        protected ArtworkStorageService $storageService,
        protected ArtworkValidationService $validationService
    ) {}

    /**
     * Resolve authenticated Sanctum user even when route is accessed without auth:sanctum middleware.
     */
    protected function resolveUser(Request $request)
    {
        return $request->user('sanctum') ?? auth('sanctum')->user() ?? $request->user();
    }

    /**
     * Return the user's or guest's saved designs.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        $sessionId = $request->header('X-Session-ID')
            ?? $request->input('session_id')
            ?? ($request->hasSession() ? $request->session()->getId() : null);

        $query = Artwork::query()->where('source_type', 'designer');

        if ($user) {
            $query->where('user_id', $user->id);
        } elseif (!empty($sessionId)) {
            $query->where('session_id', $sessionId);
        } else {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $artworks = $query
            ->when(
                $request->filled('product_id'),
                fn ($q) => $q->where(
                    'product_id',
                    $request->string('product_id')
                )
            )
            ->with(['product:id,name,slug', 'template:id,name,thumbnail_url'])
            ->latest('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $artworks,
        ]);
    }

    /**
     * Save a new customer Fabric.js design.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'required',
                'uuid',
                Rule::exists('products', 'id'),
            ],

            'template_id' => [
                'nullable',
                'uuid',
                Rule::exists('design_templates', 'id'),
            ],

            'design_template_id' => [
                'nullable',
                'uuid',
                Rule::exists('design_templates', 'id'),
            ],

            'session_id' => [
                'nullable',
                'string',
                'max:255',
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
                'nullable',
                'integer',
                'min:1',
                'max:30000',
            ],

            'height_px' => [
                'nullable',
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

            'unit' => [
                'nullable',
                'string',
                'in:mm,px,in',
            ],

            'bleed' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'safe_area' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'background_color' => [
                'nullable',
                'string',
                'max:20',
            ],

            'thumbnail_url' => [
                'nullable',
                'string',
            ],

            'customer_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $templateId = $validated['template_id'] ?? $validated['design_template_id'] ?? null;

        // Prevent using a template belonging to another product.
        if (!empty($templateId)) {
            $templateMatchesProduct = DesignTemplate::query()
                ->whereKey($templateId)
                ->where('product_id', $validated['product_id'])
                ->exists();

            if (!$templateMatchesProduct) {
                throw ValidationException::withMessages([
                    'template_id' => [
                        'The selected template does not belong to this product.',
                    ],
                ]);
            }
        }

        // Prevent embedded Base64/blob images from entering MySQL
        $this->ensureCanvasHasNoEmbeddedImages($validated['canvas_json']);

        // Convert incoming Base64 thumbnail to a persisted public storage file
        $thumbnailUrl = $this->handleThumbnail($validated['thumbnail_url'] ?? null);

        $user = $this->resolveUser($request);
        $sessionId = $user ? null : ($validated['session_id'] ?? $request->header('X-Session-ID') ?? (string) Str::uuid());

        $artwork = DB::transaction(function () use ($validated, $user, $sessionId, $templateId, $thumbnailUrl) {
            return Artwork::create([
                'user_id' => $user?->id,
                'session_id' => $sessionId,
                'product_id' => $validated['product_id'],
                'template_id' => $templateId,
                'design_template_id' => $templateId,
                'name' => $validated['name'] ?? 'Untitled Design',

                'source_type' => 'designer',
                'design_status' => 'draft',

                'canvas_json' => $validated['canvas_json'],
                'document_settings' => $validated['document_settings'] ?? null,
                'width_px' => $validated['width_px'] ?? 1063,
                'height_px' => $validated['height_px'] ?? 591,
                'dpi' => $validated['dpi'] ?? 300,
                'unit' => $validated['unit'] ?? 'mm',
                'bleed' => $validated['bleed'] ?? null,
                'safe_area' => $validated['safe_area'] ?? null,
                'background_color' => $validated['background_color'] ?? '#ffffff',

                'thumbnail_url' => $thumbnailUrl,
                'customer_notes' => $validated['customer_notes'] ?? null,

                'storage_disk' => config('filesystems.default', 'public'),
            ]);
        });

        $artwork->load(['product:id,name,slug', 'template:id,name,thumbnail_url']);

        return response()->json([
            'success' => true,
            'message' => 'Artwork saved successfully.',
            'data' => $artwork,
        ], 201);
    }

    /**
     * Store or initialize a draft artwork (public endpoint, guest or authenticated).
     */
    public function storeDraft(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'nullable',
                'uuid',
                Rule::exists('products', 'id'),
            ],

            'template_id' => [
                'nullable',
                'uuid',
                Rule::exists('design_templates', 'id'),
            ],

            'design_template_id' => [
                'nullable',
                'uuid',
                Rule::exists('design_templates', 'id'),
            ],

            'session_id' => [
                'nullable',
                'string',
                'max:255',
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
                'nullable',
                'integer',
                'min:1',
                'max:30000',
            ],

            'height_px' => [
                'nullable',
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

            'unit' => [
                'nullable',
                'string',
                'in:mm,px,in',
            ],

            'bleed' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'safe_area' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'background_color' => [
                'nullable',
                'string',
                'max:20',
            ],

            'thumbnail_url' => [
                'nullable',
                'string',
            ],

            'customer_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $templateId = $validated['template_id'] ?? $validated['design_template_id'] ?? null;

        // Prevent embedded Base64/blob images from entering MySQL
        $this->ensureCanvasHasNoEmbeddedImages($validated['canvas_json']);

        // Convert incoming Base64 thumbnail to a persisted public storage file
        $thumbnailUrl = $this->handleThumbnail($validated['thumbnail_url'] ?? null);

        $user = $this->resolveUser($request);
        $sessionId = $user ? null : ($validated['session_id'] ?? $request->header('X-Session-ID') ?? (string) Str::uuid());

        $artwork = DB::transaction(function () use ($validated, $user, $sessionId, $templateId, $thumbnailUrl) {
            return Artwork::create([
                'user_id' => $user?->id,
                'session_id' => $sessionId,
                'product_id' => $validated['product_id'] ?? null,
                'template_id' => $templateId,
                'design_template_id' => $templateId,
                'name' => $validated['name'] ?? 'Untitled Design Draft',

                'source_type' => 'designer',
                'design_status' => 'draft',

                'canvas_json' => $validated['canvas_json'],
                'document_settings' => $validated['document_settings'] ?? null,
                'width_px' => $validated['width_px'] ?? 1063,
                'height_px' => $validated['height_px'] ?? 591,
                'dpi' => $validated['dpi'] ?? 300,
                'unit' => $validated['unit'] ?? 'mm',
                'bleed' => $validated['bleed'] ?? null,
                'safe_area' => $validated['safe_area'] ?? null,
                'background_color' => $validated['background_color'] ?? '#ffffff',

                'thumbnail_url' => $thumbnailUrl,
                'customer_notes' => $validated['customer_notes'] ?? null,

                'storage_disk' => config('filesystems.default', 'public'),
            ]);
        });

        $artwork->load(['product:id,name,slug', 'template:id,name,thumbnail_url']);

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
            'template',
            'designTemplate',
        ]);

        return response()->json([
            'success' => true,
            'data' => $artwork,
        ]);
    }

    /**
     * Update an existing customer design.
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

            'unit' => [
                'sometimes',
                'string',
                'in:mm,px,in',
            ],

            'bleed' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'safe_area' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'background_color' => [
                'sometimes',
                'nullable',
                'string',
                'max:20',
            ],

            'thumbnail_url' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'customer_notes' => [
                'sometimes',
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        if (array_key_exists('canvas_json', $validated)) {
            $this->ensureCanvasHasNoEmbeddedImages($validated['canvas_json']);
        }

        if (array_key_exists('thumbnail_url', $validated)) {
            $validated['thumbnail_url'] = $this->handleThumbnail($validated['thumbnail_url']);
        }

        DB::transaction(function () use ($artwork, $validated) {
            $artwork->update($validated);
        });

        $artwork->refresh();
        $artwork->load([
            'product',
            'template',
            'designTemplate',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artwork updated successfully.',
            'data' => $artwork,
        ]);
    }

    /**
     * Mark an artwork as completed and ready for production.
     */
    public function complete(
        Request $request,
        Artwork $artwork
    ): JsonResponse {
        $this->ensureOwner($request, $artwork);

        $artwork->update([
            'design_status' => 'completed',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artwork marked as completed.',
            'data' => $artwork,
        ]);
    }

    /**
     * Delete an artwork.
     */
    public function destroy(
        Request $request,
        Artwork $artwork
    ): JsonResponse {
        $this->ensureOwner($request, $artwork);

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
     * Return one artwork publicly (for loading in the designer with fallback).
     */
    public function showPublic(Request $request, string $artworkId): JsonResponse
    {
        $artwork = Artwork::with(['product', 'template', 'designTemplate'])
            ->findOrFail($artworkId);

        return response()->json([
            'success' => true,
            'data' => $artwork,
        ]);
    }

    /**
     * Ensure customers can only access their own designs, while admins can manage all designs.
     */
    private function ensureOwner(
        Request $request,
        Artwork $artwork
    ): void {
        $user = $this->resolveUser($request);

        // 1. Authenticated user ownership and staff roles
        if ($user) {
            if (in_array($user->role, ['admin', 'production_manager', 'prepress_operator', 'support'], true)) {
                return;
            }
            if ($artwork->user_id && (int) $artwork->user_id === (int) $user->id) {
                return;
            }
            if ($artwork->user_id && (int) $artwork->user_id !== (int) $user->id) {
                abort(403, 'You do not have permission to access this artwork.');
            }
        }

        // 2. Guest session access
        $sessionId = $request->header('X-Session-ID')
            ?? $request->input('session_id')
            ?? ($request->hasSession() ? $request->session()->getId() : null);

        if (!$artwork->user_id && !empty($artwork->session_id) && !empty($sessionId) && hash_equals((string) $artwork->session_id, (string) $sessionId)) {
            return;
        }

        // Legacy / guest without session restriction fallback
        if (!$artwork->user_id && empty($artwork->session_id)) {
            return;
        }

        abort(403, 'You do not have permission to access this artwork.');
    }

    /**
     * Reject Base64 and blob images embedded in Fabric canvas JSON.
     */
    private function ensureCanvasHasNoEmbeddedImages(array $canvasJson): void
    {
        $encoded = json_encode($canvasJson, JSON_UNESCAPED_SLASHES);

        if ($encoded === false) {
            throw ValidationException::withMessages([
                'canvas_json' => ['Canvas JSON could not be encoded.'],
            ]);
        }

        if (str_contains($encoded, 'data:image/') || str_contains($encoded, 'blob:')) {
            throw ValidationException::withMessages([
                'canvas_json' => [
                    'Canvas images must use uploaded file URLs. Base64 and blob: images cannot be stored inside canvas JSON.',
                ],
            ]);
        }
    }

    /**
     * Convert incoming Base64 thumbnail to a persisted public storage file.
     */
    private function handleThumbnail(?string $thumbnailUrl): ?string
    {
        if ($thumbnailUrl === null || trim($thumbnailUrl) === '') {
            return null;
        }

        // Existing storage URL does not need processing.
        if (!str_starts_with($thumbnailUrl, 'data:image/')) {
            return $thumbnailUrl;
        }

        $matched = preg_match(
            '#^data:image/(png|jpe?g|webp|svg\+xml);base64,(.+)$#si',
            $thumbnailUrl,
            $matches
        );

        if ($matched !== 1) {
            if (preg_match('#^data:image/svg\+xml;utf8,(.+)$#si', $thumbnailUrl, $svgMatches)) {
                $binary = rawurldecode($svgMatches[1]);
                $extension = 'svg';
            } else {
                throw ValidationException::withMessages([
                    'thumbnail_url' => [
                        'The thumbnail must be a PNG, JPG, JPEG, WebP or SVG image.',
                    ],
                ]);
            }
        } else {
            $extension = strtolower($matches[1]);
            if ($extension === 'jpeg') {
                $extension = 'jpg';
            } elseif ($extension === 'svg+xml') {
                $extension = 'svg';
            }

            $binary = base64_decode($matches[2], true);

            if ($binary === false) {
                throw ValidationException::withMessages([
                    'thumbnail_url' => [
                        'The thumbnail image data is invalid.',
                    ],
                ]);
            }
        }

        // Limit thumbnail size to 5 MB.
        if (strlen($binary) > 5 * 1024 * 1024) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail must not exceed 5 MB.',
                ],
            ]);
        }

        $path = 'artworks/thumb_' . Str::uuid() . '.' . $extension;

        $stored = Storage::disk('public')->put($path, $binary);

        if (!$stored) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail could not be stored.',
                ],
            ]);
        }

        return url('/api/v1/storage/' . $path);
    }
}