<?php

namespace App\Http\Controllers\Api\V1\Designer;

use App\Http\Controllers\Controller;
use App\Models\DesignTemplate;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DesignerController extends Controller
{
    /**
     * Return active templates belonging to a product.
    /**
     * Return active templates belonging to a product, or all active templates.
     */
    public function templates(?string $productId = null): JsonResponse
    {
        $query = DesignTemplate::query()->where('is_active', true);

        if (!empty($productId) && $productId !== 'all' && $productId !== 'default' && $productId !== 'general') {
            $product = Product::query()
                ->where('id', $productId)
                ->orWhere('slug', $productId)
                ->first();

            $productIdVal = $product ? $product->id : $productId;
            $query->where('product_id', $productIdVal);
        }

        $templates = $query->with('product:id,name,slug')->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * Return all templates for the admin templates table.
     * canvas_json is excluded because it may be very large.
     */
    public function indexTemplates(): JsonResponse
    {
        $templates = DesignTemplate::query()
            ->select([
                'id',
                'product_id',
                'name',
                'category',
                'thumbnail_url',
                'is_active',
                'created_at',
                'updated_at',
            ])
            ->with('product:id,name,slug')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * Store an original editable template for a product.
     */
    public function storeTemplate(Request $request, string $productId): JsonResponse
    {
        $product = Product::query()->findOrFail($productId);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'canvas_json' => ['required', 'array'],
            'thumbnail_url' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $template = $product->templates()->create([
            'name' => $validated['name'],
            'category' => $validated['category'] ?? null,
            'canvas_json' => $validated['canvas_json'],
            'thumbnail_url' => $validated['thumbnail_url'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template saved successfully.',
            'data' => $template,
        ], 201);
    }

    /**
     * Return a single template by ID for admin editing.
     */
    public function showTemplate(string $id): JsonResponse
    {
        $template = DesignTemplate::with('product:id,name,slug,category_id')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $template,
        ]);
    }

    /**
     * Store a new template from the admin template form.
     */
    public function storeAdminTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'uuid', 'exists:products,id'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'canvas_json' => ['nullable', 'array'],
            'thumbnail_url' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $thumbnailUrl = $validated['thumbnail_url'] ?? null;
        if (!empty($thumbnailUrl) && str_starts_with($thumbnailUrl, 'data:image/')) {
            if (preg_match('#^data:image/(\w+);base64,(.+)$#si', $thumbnailUrl, $matches)) {
                $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
                $binary = base64_decode($matches[2]);
                if ($binary !== false) {
                    $filename = 'templates/thumb_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
                    \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $binary);
                    $thumbnailUrl = '/storage/' . $filename;
                }
            }
        }

        $defaultCanvasJson = [
            'version' => '6.0.0',
            'objects' => [],
            'background' => '#ffffff',
        ];

        $template = DesignTemplate::create([
            'product_id' => $validated['product_id'],
            'name' => $validated['name'],
            'category' => $validated['category'] ?? 'Corporate',
            'canvas_json' => $validated['canvas_json'] ?? $defaultCanvasJson,
            'thumbnail_url' => $thumbnailUrl,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $template->load('product:id,name,slug');

        return response()->json([
            'success' => true,
            'message' => 'Template created successfully.',
            'data' => $template,
        ], 201);
    }

    /**
     * Update a design template.
     */
    public function updateTemplate(Request $request, string $id): JsonResponse
    {
        $template = DesignTemplate::findOrFail($id);

        $validated = $request->validate([
            'product_id' => ['sometimes', 'required', 'uuid', 'exists:products,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'canvas_json' => ['sometimes', 'array'],
            'thumbnail_url' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('thumbnail_url', $validated)) {
            $thumbnailUrl = $validated['thumbnail_url'];
            if (!empty($thumbnailUrl) && str_starts_with($thumbnailUrl, 'data:image/')) {
                if (preg_match('#^data:image/(\w+);base64,(.+)$#si', $thumbnailUrl, $matches)) {
                    $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
                    $binary = base64_decode($matches[2]);
                    if ($binary !== false) {
                        $filename = 'templates/thumb_' . \Illuminate\Support\Str::uuid() . '.' . $ext;
                        \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $binary);
                        $validated['thumbnail_url'] = '/storage/' . $filename;
                    }
                }
            }
        }

        $template->update($validated);
        $template->load('product:id,name,slug');

        return response()->json([
            'success' => true,
            'message' => 'Template updated successfully.',
            'data' => $template,
        ]);
    }

    /**
     * Delete a design template.
     */
    public function destroyTemplate(string $id): JsonResponse
    {
        $template = DesignTemplate::findOrFail($id);
        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully.',
        ]);
    }

    /**
     * Serve local public storage files with full CORS support.
     */
    public function serveStorage(string $path)
    {
        $cleanPath = ltrim(preg_replace('#^(storage/|storage/app/public/|public/storage/)?#i', '', trim($path)), '/');
        $fullPath = storage_path('app/public/' . $cleanPath);

        if (!file_exists($fullPath) || is_dir($fullPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Storage asset not found.',
            ], 404);
        }

        $mimeType = mime_content_type($fullPath) ?: 'application/octet-stream';

        return response()->file($fullPath, [
            'Content-Type' => $mimeType,
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers' => '*',
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

