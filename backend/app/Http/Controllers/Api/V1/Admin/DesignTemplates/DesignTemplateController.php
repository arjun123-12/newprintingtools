<?php

namespace App\Http\Controllers\Api\V1\Admin\DesignTemplates;

use App\Http\Controllers\Controller;
use App\Models\DesignTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DesignTemplateController extends Controller
{
    /**
     * Return templates for the admin table.
     *
     * canvas_json is excluded because it can be large.
     * Use show() to load the complete editable template.
     */
    public function index(Request $request): JsonResponse
    {
        $templates = DesignTemplate::query()
            ->select([
                'id',
                'product_id',
                'name',
                'category',
                'print_sides',
                'width_mm',
                'height_mm',
                'margin_mm',
                'bleed_mm',
                'safe_area_mm',
                'artwork_config',
                'thumbnail_url',
                'is_active',
                'created_at',
                'updated_at',
            ])
            ->with('product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm')
            ->when(
                $request->filled('product_id'),
                function ($query) use ($request) {
                    $query->where(
                        'product_id',
                        (string) $request->input('product_id')
                    );
                }
            )
            ->latest()
            ->get();

        $templates->each(
            fn (DesignTemplate $template) =>
                $this->appendDocumentSettings($template)
        );

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * Create an editable template draft.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'required',
                'uuid',
                'exists:products,id',
            ],
            'name' => [
                'required',
                'string',
                'max:255',
            ],
            'category' => [
                'nullable',
                'string',
                'max:255',
            ],
            'print_sides' => [
                'nullable',
                Rule::in(['front', 'back', 'both']),
            ],
            'width_mm' => [
                'nullable',
                'numeric',
                'gt:0',
            ],
            'height_mm' => [
                'nullable',
                'numeric',
                'gt:0',
            ],
            'margin_mm' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'bleed_mm' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'safe_area_mm' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'canvas_json' => [
                'nullable',
                'array',
            ],
            'back_canvas_json' => [
                'nullable',
                'array',
            ],
            'template_json' => [
                'nullable',
                'array',
            ],
            'artwork_config' => [
                'nullable',
                'array',
            ],
            'thumbnail_url' => [
                'nullable',
                'string',
            ],
            'is_active' => [
                'sometimes',
                'boolean',
            ],
        ]);

        $defaultCanvasJson = [
            'version' => '6.0.0',
            'objects' => [],
            'background' => '#ffffff',
        ];

        $canvasJson =
            $validated['template_json']
            ?? $validated['canvas_json']
            ?? $defaultCanvasJson;

        // Prevent large Base64 images from entering MySQL.
        $this->ensureCanvasHasNoEmbeddedImages(
            $canvasJson
        );

        if (!empty($validated['back_canvas_json'])) {
            $this->ensureCanvasHasNoEmbeddedImages(
                $validated['back_canvas_json']
            );
        }

        // A Base64 thumbnail is converted to a real file.
        $thumbnailUrl = $this->handleThumbnail(
            $validated['thumbnail_url'] ?? null
        );

        $template = DesignTemplate::create([
            'product_id' => $validated['product_id'],
            'name' => $validated['name'],
            'category' =>
                $validated['category'] ?? 'Corporate',
            'print_sides' => $validated['print_sides'] ?? 'front',
            'width_mm' => $validated['width_mm'] ?? null,
            'height_mm' => $validated['height_mm'] ?? null,
            'margin_mm' => $validated['margin_mm'] ?? 0,
            'bleed_mm' => $validated['bleed_mm'] ?? 0,
            'safe_area_mm' => $validated['safe_area_mm'] ?? 0,
            'canvas_json' => $canvasJson,
            'back_canvas_json' => $validated['back_canvas_json'] ?? null,
            'artwork_config' => $validated['artwork_config'] ?? null,
            'thumbnail_url' => $thumbnailUrl,

            // New templates remain hidden until published.
            'is_active' =>
                $validated['is_active'] ?? false,
        ]);

        $template->load('product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm');
        $this->appendDocumentSettings($template);

        return response()->json([
            'success' => true,
            'message' => 'Template draft created successfully.',
            'data' => $template,
        ], 201);
    }

    /**
     * Load one complete template for editing.
     */
    public function show(
        DesignTemplate $template
    ): JsonResponse {
        $template->load(
            'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm'
        );
        $this->appendDocumentSettings($template);

        return response()->json([
            'success' => true,
            'data' => $template,
        ]);
    }

    /**
     * Update an existing editable template.
     */
    public function update(
        Request $request,
        DesignTemplate $template
    ): JsonResponse {
        $validated = $request->validate([
            'product_id' => [
                'sometimes',
                'required',
                'uuid',
                'exists:products,id',
            ],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],
            'category' => [
                'nullable',
                'string',
                'max:255',
            ],
            'print_sides' => [
                'sometimes',
                'nullable',
                Rule::in(['front', 'back', 'both']),
            ],
            'width_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],
            'height_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],
            'margin_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'bleed_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'safe_area_mm' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'canvas_json' => [
                'sometimes',
                'required_without:template_json',
                'array',
            ],
            'back_canvas_json' => [
                'sometimes',
                'nullable',
                'array',
            ],
            'template_json' => [
                'sometimes',
                'required_without:canvas_json',
                'array',
            ],
            'artwork_config' => [
                'nullable',
                'array',
            ],
            'thumbnail_url' => [
                'nullable',
                'string',
            ],
            'is_active' => [
                'sometimes',
                'boolean',
            ],
        ]);

        if (array_key_exists('template_json', $validated) && !array_key_exists('canvas_json', $validated)) {
            $validated['canvas_json'] = $validated['template_json'];
        }
        unset($validated['template_json']);

        if (
            array_key_exists(
                'canvas_json',
                $validated
            )
        ) {
            $this->ensureCanvasHasNoEmbeddedImages(
                $validated['canvas_json']
            );
        }

        if (
            array_key_exists(
                'back_canvas_json',
                $validated
            ) && !empty($validated['back_canvas_json'])
        ) {
            $this->ensureCanvasHasNoEmbeddedImages(
                $validated['back_canvas_json']
            );
        }

        if (
            array_key_exists(
                'thumbnail_url',
                $validated
            )
        ) {
            $validated['thumbnail_url'] =
                $this->handleThumbnail(
                    $validated['thumbnail_url']
                );
        }

        $template->update($validated);

        $template->refresh();
        $template->load(
            'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm'
        );
        $this->appendDocumentSettings($template);

        return response()->json([
            'success' => true,
            'message' => 'Template updated successfully.',
            'data' => $template,
        ]);
    }

    /**
     * Delete a design template.
     */
    public function destroy(
        DesignTemplate $template
    ): JsonResponse {
        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully.',
        ]);
    }

    /**
     * Convert a Base64 thumbnail into a storage file.
     */
    private function handleThumbnail(
        ?string $thumbnailUrl
    ): ?string {
        if (empty($thumbnailUrl)) {
            return null;
        }

        // Existing storage URL does not need processing.
        if (
            !str_starts_with(
                $thumbnailUrl,
                'data:image/'
            )
        ) {
            return $thumbnailUrl;
        }

        $matched = preg_match(
            '#^data:image/(png|jpe?g|webp|svg\+xml);base64,(.+)$#si',
            $thumbnailUrl,
            $matches
        );

        if ($matched !== 1) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail must be a PNG, JPG, JPEG, WebP or SVG image.',
                ],
            ]);
        }

        $extension = strtolower($matches[1]);

        if ($extension === 'jpeg') {
            $extension = 'jpg';
        } elseif ($extension === 'svg+xml') {
            $extension = 'svg';
        }

        $binary = base64_decode(
            $matches[2],
            true
        );

        if ($binary === false) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail image data is invalid.',
                ],
            ]);
        }

        // Limit thumbnail size to 5 MB.
        if (strlen($binary) > 5 * 1024 * 1024) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail must not exceed 5 MB.',
                ],
            ]);
        }

        $path =
            'templates/thumb_' .
            Str::uuid() .
            '.' .
            $extension;

        $stored = Storage::disk('public')->put(
            $path,
            $binary
        );

        if (!$stored) {
            throw ValidationException::withMessages([
                'thumbnail_url' => [
                    'The thumbnail could not be stored.',
                ],
            ]);
        }

        return Storage::disk('public')->url($path);
    }

    /**
     * Reject Base64 images embedded in Fabric canvas JSON.
     *
     * Artwork image files must be stored in local storage,
     * Cloudflare R2 or S3. Only their URLs belong in JSON.
     */
    private function ensureCanvasHasNoEmbeddedImages(
        array $canvasJson
    ): void {
        $encoded = json_encode(
            $canvasJson,
            JSON_UNESCAPED_SLASHES
        );

        if ($encoded === false) {
            throw ValidationException::withMessages([
                'canvas_json' => [
                    'Canvas JSON could not be encoded.',
                ],
            ]);
        }

        if (
            str_contains(
                $encoded,
                'data:image/'
            ) ||
            str_contains(
                $encoded,
                'blob:'
            )
        ) {
            throw ValidationException::withMessages([
                'canvas_json' => [
                    'Canvas images must use uploaded file URLs. Base64 and blob: images cannot be stored inside canvas JSON.',
                ],
            ]);
        }
    }

    /**
     * Expose one stable settings object for the React designer. Template
     * values win; product values are only fallbacks for older templates.
     */
    private function appendDocumentSettings(
        DesignTemplate $template
    ): DesignTemplate {
        $product = $template->relationLoaded('product')
            ? $template->product
            : null;
        $artwork = is_array($template->artwork_config)
            ? $template->artwork_config
            : [];

        $width = $template->width_mm
            ?? $product?->width_mm
            ?? $artwork['width']
            ?? 90;
        $height = $template->height_mm
            ?? $product?->height_mm
            ?? $artwork['height']
            ?? 50;
        $bleed = $template->bleed_mm
            ?? $product?->bleed_mm
            ?? $artwork['bleed']
            ?? 3;
        $safeArea = $template->safe_area_mm
            ?? $product?->safe_area_mm
            ?? $artwork['safeArea']
            ?? $artwork['safe_area']
            ?? 3;
        $margin = $template->margin_mm
            ?? $product?->margin_mm
            ?? $artwork['margin']
            ?? 0;

        return $template->setAttribute('document_settings', [
            'name' => $template->name,
            'width' => (float) $width,
            'height' => (float) $height,
            'unit' => $artwork['unit'] ?? 'mm',
            'dpi' => (int) ($artwork['dpi'] ?? 300),
            'bleed' => (float) $bleed,
            'safeArea' => (float) $safeArea,
            'margin' => (float) $margin,
            'backgroundColor' =>
                $artwork['backgroundColor'] ?? '#ffffff',
            'printSides' => $template->print_sides
                ?? $product?->print_sides
                ?? 'front',
        ]);
    }
}
