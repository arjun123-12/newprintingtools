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
     * Serve a generated background-removal image through Laravel.
     *
     * Direct /storage URLs can bypass Laravel's CORS middleware when they are
     * served as static files. Fabric.js loads canvas images with anonymous
     * CORS, so these files must be returned through an API route.
     */
    public function serveRemovedBackground(string $filename)
    {
        $decodedFilename = rawurldecode($filename);

        // Only a single file name is accepted. This blocks directory
        // traversal, encoded slashes, backslashes and null-byte injection.
        if (
            $decodedFilename === '' ||
            $decodedFilename !== basename($decodedFilename) ||
            str_contains($decodedFilename, '..') ||
            str_contains($decodedFilename, '/') ||
            str_contains($decodedFilename, '\\') ||
            str_contains($decodedFilename, "\0")
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid background image filename.',
            ], 400);
        }

        $extension = strtolower(pathinfo($decodedFilename, PATHINFO_EXTENSION));
        $allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];

        if (!in_array($extension, $allowedExtensions, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported background image format.',
            ], 415);
        }

        $relativePath = 'designer/removed-backgrounds/' . $decodedFilename;
        $disk = Storage::disk('public');

        if (!$disk->exists($relativePath)) {
            return response()->json([
                'success' => false,
                'message' => 'Removed background image not found.',
            ], 404);
        }

        $mimeType = match ($extension) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };

        return $disk->response($relativePath, null, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=86400, immutable',
            'Cross-Origin-Resource-Policy' => 'cross-origin',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

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
            // Trusted stock-image providers. The boundary-safe suffix check
            // below also permits their CDN subdomains, such as
            // cdn.pixabay.com and images.pexels.com.
            'pixabay.com',
            'pexels.com',
            'freepik.com',
            'flaticon.com',
            'b2bpic.net',
            'magnific.com',
            'downloadscdn6.magnific.com',
        ]);

        if (env('ALLOWED_IMAGE_PROXY_DOMAINS')) {
            $extraDomains = array_values(array_filter(array_map(
                static fn (string $domain): string => strtolower(trim($domain)),
                explode(',', (string) env('ALLOWED_IMAGE_PROXY_DOMAINS'))
            )));
            $allowedHosts = array_merge($allowedHosts, $extraDomains);
        }

        $isAllowedHost = false;
        foreach ($allowedHosts as $allowed) {
            $allowed = strtolower(trim((string) $allowed));
            if ($allowed === '') {
                continue;
            }

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
