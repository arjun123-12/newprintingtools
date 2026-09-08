<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignTemplate;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DesignerController extends Controller
{
    /**
     * Return active templates belonging to a product.
     */
    public function templates(?string $productId = null): JsonResponse
    {
        $query = DesignTemplate::query()->where('is_active', true);

        if (!empty($productId) && $productId !== 'all' && $productId !== 'default' && $productId !== 'general') {
            $product = Product::query()
                ->where('id', $productId)
                ->orWhere('slug', $productId)
                ->first();

            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found.',
                ], 404);
            }

            $query->where('product_id', $product->id);
        }

        $templates = $query->with([
            'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm',
            'pages.productSide',
        ])->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * Return a single active template belonging to a product for customers.
     */
    public function showTemplate(string $productId, string $templateId): JsonResponse
    {
        $product = Product::query()
            ->where('id', $productId)
            ->orWhere('slug', $productId)
            ->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
            ], 404);
        }

        $template = DesignTemplate::query()
            ->where('id', $templateId)
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->with([
                'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm',
                'pages.productSide',
            ])
            ->first();

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Template not found or inactive for this product.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $template,
        ]);
    }

    /**
     * Return all templates for the admin templates table.
     * canvas_json is excluded because it may be very large.
     */
    // public function indexTemplates(): JsonResponse
    // {
    //     $templates = DesignTemplate::query()
    //         ->select([
    //             'id',
    //             'product_id',
    //             'name',
    //             'category',
    //             'thumbnail_url',
    //             'is_active',
    //             'created_at',
    //             'updated_at',
    //         ])
    //         ->with('product:id,name,slug')
    //         ->latest()
    //         ->get();

    //     return response()->json([
    //         'success' => true,
    //         'data' => $templates,
    //     ]);
    // }

    /**
     * Store an original editable template for a product.
     */
    // public function storeTemplate(Request $request, string $productId): JsonResponse
    // {
    //     $product = Product::query()->findOrFail($productId);

    //     $validated = $request->validate([
    //         'name' => ['required', 'string', 'max:255'],
    //         'category' => ['nullable', 'string', 'max:255'],
    //         'canvas_json' => ['required', 'array'],
    //         'thumbnail_url' => ['nullable', 'string', 'max:255'],
    //         'is_active' => ['sometimes', 'boolean'],
    //     ]);

    //     $template = $product->templates()->create([
    //         'name' => $validated['name'],
    //         'category' => $validated['category'] ?? null,
    //         'canvas_json' => $validated['canvas_json'],
    //         'thumbnail_url' => $validated['thumbnail_url'] ?? null,
    //         'is_active' => $validated['is_active'] ?? true,
    //     ]);

    //     return response()->json([
    //         'success' => true,
    //         'message' => 'Template saved successfully.',
    //         'data' => $template,
    //     ], 201);
    // }

    /**
     * Return a single template by ID for admin editing.
     */
    // public function showTemplate(string $id): JsonResponse
    // {
    //     $template = DesignTemplate::with('product:id,name,slug,category_id')->findOrFail($id);

    //     return response()->json([
    //         'success' => true,
    //         'data' => $template,
    //     ]);
    // }

    /**
     * Store a new template from the admin template form.
     */
    // public function storeAdminTemplate(Request $request): JsonResponse
    // {
    //     $validated = $request->validate([
    //         'product_id' => ['required', 'uuid', 'exists:products,id'],
    //         'name' => ['required', 'string', 'max:255'],
    //         'category' => ['nullable', 'string', 'max:255'],
    //         'canvas_json' => ['nullable', 'array'],
    //         'thumbnail_url' => ['nullable', 'string'],
    //         'is_active' => ['nullable', 'boolean'],
    //     ]);

    //     $thumbnailUrl = $validated['thumbnail_url'] ?? null;
    //     if (!empty($thumbnailUrl) && str_starts_with($thumbnailUrl, 'data:image/')) {
    //         if (preg_match('#^data:image/(\w+);base64,(.+)$#si', $thumbnailUrl, $matches)) {
    //             $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
    //             $binary = base64_decode($matches[2]);
    //             if ($binary !== false) {
    //                 $filename = 'templates/thumb_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
    //                 \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $binary);
    //                 $thumbnailUrl = '/storage/' . $filename;
    //             }
    //         }
    //     }

    //     $defaultCanvasJson = [
    //         'version' => '6.0.0',
    //         'objects' => [],
    //         'background' => '#ffffff',
    //     ];

    //     $template = DesignTemplate::create([
    //         'product_id' => $validated['product_id'],
    //         'name' => $validated['name'],
    //         'category' => $validated['category'] ?? 'Corporate',
    //         'canvas_json' => $validated['canvas_json'] ?? $defaultCanvasJson,
    //         'thumbnail_url' => $thumbnailUrl,
    //         'is_active' => $validated['is_active'] ?? true,
    //     ]);

    //     $template->load('product:id,name,slug');

    //     return response()->json([
    //         'success' => true,
    //         'message' => 'Template created successfully.',
    //         'data' => $template,
    //     ], 201);
    // }

    /**
     * Update a design template.
     */
    // public function updateTemplate(Request $request, string $id): JsonResponse
    // {
    //     $template = DesignTemplate::findOrFail($id);

    //     $validated = $request->validate([
    //         'product_id' => ['sometimes', 'required', 'uuid', 'exists:products,id'],
    //         'name' => ['sometimes', 'required', 'string', 'max:255'],
    //         'category' => ['nullable', 'string', 'max:255'],
    //         'canvas_json' => ['sometimes', 'array'],
    //         'thumbnail_url' => ['nullable', 'string'],
    //         'is_active' => ['sometimes', 'boolean'],
    //     ]);

    //     if (array_key_exists('thumbnail_url', $validated)) {
    //         $thumbnailUrl = $validated['thumbnail_url'];
    //         if (!empty($thumbnailUrl) && str_starts_with($thumbnailUrl, 'data:image/')) {
    //             if (preg_match('#^data:image/(\w+);base64,(.+)$#si', $thumbnailUrl, $matches)) {
    //                 $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
    //                 $binary = base64_decode($matches[2]);
    //                 if ($binary !== false) {
    //                     $filename = 'templates/thumb_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
    //                     \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $binary);
    //                     $validated['thumbnail_url'] = '/storage/' . $filename;
    //                 }
    //             }
    //         }
    //     }

    //     $template->update($validated);
    //     $template->load('product:id,name,slug');

    //     return response()->json([
    //         'success' => true,
    //         'message' => 'Template updated successfully.',
    //         'data' => $template,
    //     ]);
    // }

    /**
     * Delete a design template.
     */
    // public function destroyTemplate(string $id): JsonResponse
    // {
    //     $template = DesignTemplate::findOrFail($id);
    //     $template->delete();

    //     return response()->json([
    //         'success' => true,
    //         'message' => 'Template deleted successfully.',
    //     ]);
    // }

    /**
     * Serve local public storage files with full CORS support and path traversal protection.
     */
    public function serveStorage(string $path)
    {
        $rawPath = urldecode($path);

        // Prevent directory traversal and null byte injections
        if (str_contains($rawPath, '..') || str_contains($rawPath, "\0") || str_contains($rawPath, '\\')) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid storage path.',
            ], 403);
        }

        $cleanPath = ltrim(preg_replace('#^(storage/|storage/app/public/|public/storage/)?#i', '', trim($rawPath)), '/');

        // Only expose permitted designer/product storage directories
        $topDir = explode('/', $cleanPath)[0] ?? '';
        $allowedDirectories = [
            'designer',
            'templates',
            'artworks',
            'products',
            'uploads',
        ];

        if (!in_array(strtolower($topDir), $allowedDirectories, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Access to this storage directory is not permitted.',
            ], 403);
        }

        $disk = Storage::disk('public');

        if (!$disk->exists($cleanPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Storage asset not found.',
            ], 404);
        }

        $extension = strtolower(pathinfo($cleanPath, PATHINFO_EXTENSION));
        $mimeType = match ($extension) {
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'pdf' => 'application/pdf',
            'tif', 'tiff' => 'image/tiff',
            default => $disk->mimeType($cleanPath) ?: 'application/octet-stream',
        };

        return $disk->response($cleanPath, null, [
            'Content-Type' => $mimeType,
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers' => '*',
            'Cross-Origin-Resource-Policy' => 'cross-origin',
            'Cross-Origin-Embedder-Policy' => 'unsafe-none',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Secure same-origin image proxy for external & local artwork assets.
     * Prevents browser canvas tainting by ensuring CORS headers are always attached.
     */
    public function proxyImage(Request $request)
    {
        $target = (string) ($request->query('url') ?? $request->query('path') ?? '');
        $target = trim($target);

        if (empty($target)) {
            return response()->json([
                'success' => false,
                'message' => 'Missing url or path parameter.',
            ], 400);
        }

        // 1. Direct local storage path or URL
        if (
            str_starts_with($target, '/') ||
            str_starts_with($target, 'storage/') ||
            str_starts_with($target, 'products/') ||
            preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?/storage/(.+)$#i', $target, $localMatches)
        ) {
            $storageRelative = isset($localMatches[3])
                ? $localMatches[3]
                : preg_replace('#^/?(storage/|storage/app/public/|public/storage/)?#i', '', $target);

            $localFilePath = storage_path('app/public/' . ltrim($storageRelative, '/'));

            if (file_exists($localFilePath) && !is_dir($localFilePath)) {
                $mimeType = mime_content_type($localFilePath) ?: 'image/png';
                return response()->file($localFilePath, [
                    'Content-Type' => $mimeType,
                    'Access-Control-Allow-Origin' => '*',
                    'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers' => '*',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }
        }

        // 2. Validate URL domain against allowed artwork & storage origins
        if (!preg_match('#^https?://#i', $target)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid image URL provided.',
            ], 400);
        }

        $parsedUrl = parse_url($target);
        $host = strtolower($parsedUrl['host'] ?? '');

        $allowedHosts = array_filter([
            'localhost',
            '127.0.0.1',
            'artwork.printecommerce.com.au',
            'printecommerce.com.au',
            parse_url(config('app.url', ''), PHP_URL_HOST),
            parse_url(config('filesystems.disks.r2.url', ''), PHP_URL_HOST),
            parse_url(config('filesystems.disks.s3.url', ''), PHP_URL_HOST),
            'freepik.com',
            'flaticon.com',
        ]);

        if (env('ALLOWED_IMAGE_PROXY_DOMAINS')) {
            $extraDomains = array_map('trim', explode(',', env('ALLOWED_IMAGE_PROXY_DOMAINS')));
            $allowedHosts = array_merge($allowedHosts, $extraDomains);
        }

        $isAllowedHost = false;
        foreach ($allowedHosts as $allowed) {
            $allowed = strtolower($allowed);
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                $isAllowedHost = true;
                break;
            }
        }

        if (!$isAllowedHost) {
            return response()->json([
                'success' => false,
                'message' => 'Requested image domain is not in the allowed storage whitelist.',
            ], 403);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->get($target);

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fetch remote image from storage provider.',
                ], $response->status());
            }

            $contentType = $response->header('Content-Type') ?? 'image/png';

            return response($response->body(), 200, [
                'Content-Type' => $contentType,
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers' => '*',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error proxying image asset: ' . $e->getMessage(),
            ], 500);
        }
    }
}

