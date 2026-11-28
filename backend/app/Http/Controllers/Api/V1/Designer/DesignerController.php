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
    public function templates(Request $request, ?string $productId = null): JsonResponse
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

        if ($request->boolean('summary')) {
            $templates = $query->latest()->get([
                'id', 'product_id', 'name', 'category', 'width_mm', 'height_mm',
                'bleed_mm', 'safe_area_mm', 'artwork_config', 'thumbnail_url',
            ])->map(function (DesignTemplate $template) {
                $config = $template->artwork_config ?? [];
                $config['width'] = $config['width'] ?? (float) $template->width_mm;
                $config['height'] = $config['height'] ?? (float) $template->height_mm;
                $config['bleed'] = $config['bleed'] ?? (float) $template->bleed_mm;
                $config['safe_area'] = $config['safe_area'] ?? (float) $template->safe_area_mm;

                return [
                    'id' => $template->id,
                    'product_id' => $template->product_id,
                    'name' => $template->name,
                    'category' => $template->category,
                    'artwork_config' => $config,
                    'thumbnail_url' => $template->thumbnail_url,
                ];
            })->values();
        } else {
            $templates = $query->with([
                'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm,print_layout,artwork_module',
                'pages.productSide',
                'categories:id,name,slug',
            ])->latest()->get();
        }

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    public function gallery(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'category' => ['nullable', 'string', 'max:255'],
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:48'],
        ]);

        $category = mb_strtolower(explode(' ', $filters['category'] ?? '')[0]);
        $search = mb_strtolower($filters['search'] ?? '');
        $categoryProduct = null;

        if ($category !== '') {
            // Match the gallery's existing category-to-product selection order.
            $categoryProduct = Product::query()
                ->select('id', 'name', 'category_id')
                ->with(['category:id,name', 'categories:id,name'])
                ->latest()
                ->get()
                ->first(function (Product $product) use ($category): bool {
                    $categoryName = $product->category?->name ?? $product->categories->first()?->name ?? 'Uncategorized';

                    return str_contains(mb_strtolower("$product->name $categoryName"), $category);
                });
        }

        $query = DesignTemplate::query()
            ->join('products', 'products.id', '=', 'design_templates.product_id')
            ->whereNull('products.deleted_at')
            ->where('design_templates.is_active', true);

        if ($categoryProduct) {
            $query->where('design_templates.product_id', $categoryProduct->id);
        }

        $nameExpression = "LOWER(CONCAT(design_templates.name, ' ', products.name))";
        $terms = array_filter([$categoryProduct ? '' : $category, $search], fn (string $term) => $term !== '');
        foreach ($terms as $term) {
            $escaped = strtr($term, ['!' => '!!', '%' => '!%', '_' => '!_']);
            $query->whereRaw("$nameExpression LIKE ? ESCAPE '!'", ["%$escaped%"]);
        }

        $page = $query
            ->orderByDesc('products.created_at')
            ->orderBy('products.id')
            ->orderByDesc('design_templates.created_at')
            ->orderBy('design_templates.id')
            ->simplePaginate($filters['per_page'] ?? 24, [
                'design_templates.id',
                'design_templates.product_id',
                'design_templates.name',
                'design_templates.thumbnail_url',
                'design_templates.width_mm',
                'design_templates.height_mm',
                'design_templates.artwork_config',
                'products.name as gallery_product_name',
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $page->getCollection()->map(function (DesignTemplate $template): array {
                    $config = $template->artwork_config ?? [];

                    return [
                        'template' => [
                            'id' => $template->id,
                            'name' => $template->name,
                            'thumbnail_url' => $template->thumbnail_url,
                            'artwork_config' => [
                                'width' => $config['width'] ?? (float) $template->width_mm,
                                'height' => $config['height'] ?? (float) $template->height_mm,
                                'unit' => $config['unit'] ?? 'mm',
                            ],
                        ],
                        'product' => ['id' => $template->product_id, 'name' => $template->gallery_product_name],
                    ];
                })->values(),
                'category_product' => $categoryProduct?->only(['id', 'name']),
                'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
            ],
        ]);
    }

    /**
     * Return a single active template belonging to a product for customers.
     */
    public function showTemplate(string $productId, string $templateId): JsonResponse
    {
        $templateQuery = DesignTemplate::query()
            ->where('id', $templateId)
            ->where('is_active', true);

        if (!empty($productId) && !in_array($productId, ['default', 'standalone', 'all', 'general'], true)) {
            $product = Product::query()
                ->where('id', $productId)
                ->orWhere('slug', $productId)
                ->first();

            if ($product) {
                $templateQuery->where(function ($q) use ($product) {
                    $q->where('product_id', $product->id)->orWhereNull('product_id');
                });
            }
        }

        $template = $templateQuery->with([
            'product:id,name,slug,print_sides,width_mm,height_mm,margin_mm,bleed_mm,safe_area_mm,print_layout,artwork_module',
            'pages.productSide',
            'categories:id,name,slug',
        ])->first();

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

            $publicRoot = realpath(storage_path('app/public'));
            $relative = ltrim(rawurldecode($storageRelative), '/');
            $localFilePath = $publicRoot && !str_contains($relative, "\0")
                ? realpath($publicRoot . DIRECTORY_SEPARATOR . $relative)
                : false;

            if ($publicRoot !== false && $localFilePath !== false) {
                $rootPrefix = $publicRoot . DIRECTORY_SEPARATOR;
                $insidePublicStorage = DIRECTORY_SEPARATOR === '\\'
                    ? strncasecmp($localFilePath, $rootPrefix, strlen($rootPrefix)) === 0
                    : str_starts_with($localFilePath, $rootPrefix);

                if (!$insidePublicStorage) {
                    return response()->json(['success' => false, 'message' => 'Asset is outside public storage.'], 403);
                }
            }

            if ($localFilePath !== false && is_file($localFilePath)) {
                $ext = strtolower(pathinfo($localFilePath, PATHINFO_EXTENSION));
                $fontMimes = [
                    'otf' => 'font/otf',
                    'ttf' => 'font/ttf',
                    'woff' => 'font/woff',
                    'woff2' => 'font/woff2',
                ];
                $mimeType = $fontMimes[$ext] ?? (mime_content_type($localFilePath) ?: 'image/png');
                if (!$this->isProxyAssetType($mimeType)) {
                    return response()->json(['success' => false, 'message' => 'Unsupported asset type.'], 415);
                }
                return response()->file($localFilePath, [
                    'X-Content-Type-Options' => 'nosniff',
                    'Content-Security-Policy' => "sandbox; default-src 'none'; style-src 'unsafe-inline'",
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

        $allowedHosts = array_filter([
            'erryimprints.com.au',
            'artwork.erryimprints.com.au',
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

        $isAllowedOrigin = static function ($uri) use ($allowedHosts): bool {
            $host = strtolower($uri->getHost());
            if (!in_array($uri->getScheme(), ['http', 'https'], true)
                || $uri->getUserInfo() !== ''
                || !in_array($uri->getPort(), [null, 80, 443], true)
                || in_array($host, ['localhost', '127.0.0.1'], true)
                || filter_var(trim($host, '[]'), FILTER_VALIDATE_IP)) {
                return false;
            }

            foreach ($allowedHosts as $allowed) {
                $allowed = strtolower(trim((string) $allowed));
                if ($allowed !== '' && ($host === $allowed || str_ends_with($host, '.' . $allowed))) {
                    return true;
                }
            }
            return false;
        };

        try {
            $isAllowedHost = $isAllowedOrigin(new \GuzzleHttp\Psr7\Uri($target));
        } catch (\InvalidArgumentException) {
            $isAllowedHost = false;
        }

        if (!$isAllowedHost) {
            return response()->json([
                'success' => false,
                'message' => 'Requested image domain is not in the allowed storage whitelist.',
            ], 403);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->withOptions([
                'allow_redirects' => [
                    'max' => 3,
                    'protocols' => ['http', 'https'],
                    'on_redirect' => static function ($request, $response, $uri) use ($isAllowedOrigin): void {
                        if (!$isAllowedOrigin($uri)) {
                            throw new \RuntimeException('Redirect destination is not an approved asset origin.');
                        }
                    },
                ],
            ])->get($target);

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fetch remote image from storage provider.',
                ], $response->status());
            }

            $contentType = $response->header('Content-Type') ?? 'image/png';

            if (!$this->isProxyAssetType($contentType)) {
                return response()->json(['success' => false, 'message' => 'Unsupported asset type.'], 415);
            }

            return response($response->body(), 200, [
                'X-Content-Type-Options' => 'nosniff',
                'Content-Security-Policy' => "sandbox; default-src 'none'; style-src 'unsafe-inline'",
                'Content-Type' => $contentType,
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers' => '*',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not load the requested image asset.',
            ], 500);
        }
    }

    private function isProxyAssetType(string $contentType): bool
    {
        $mime = strtolower(trim(explode(';', $contentType)[0]));

        return str_starts_with($mime, 'image/')
            || str_starts_with($mime, 'font/')
            || in_array($mime, ['application/octet-stream', 'application/font-woff', 'application/x-font-ttf', 'application/vnd.ms-fontobject'], true);
    }
}
