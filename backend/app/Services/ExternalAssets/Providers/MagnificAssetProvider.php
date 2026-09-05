<?php

namespace App\Services\ExternalAssets\Providers;

use App\Services\ExternalAssets\ExternalAssetProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MagnificAssetProvider implements ExternalAssetProviderInterface
{
    protected string $apiKey;
    protected string $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.magnific.api_key') ?? '';
        $this->baseUrl = config('services.magnific.api_url') ?? 'https://api.magnific.com/v1';
    }

    protected function client()
    {
        return Http::withHeaders([
            'x-magnific-api-key' => $this->apiKey,
            'Accept' => 'application/json',
        ])->withoutVerifying()->baseUrl($this->baseUrl)->timeout(30);
    }

    public function getProviderName(): string
    {
        return 'magnific';
    }

    public function search(array $params): array
    {
        $query = [
            'q' => $params['query'] ?? '',
            'page' => $params['page'] ?? 1,
            'per_page' => $params['per_page'] ?? 30,
            'order' => $params['sort'] ?? 'relevance',
        ];

        if (!empty($params['asset_type'])) {
            $query['type'] = $params['asset_type'];
        }
        if (!empty($params['category']) && $params['category'] !== 'All') {
            $query['category'] = strtolower($params['category']);
        }

        $response = $this->client()->get('/resources', $query);

        if ($response->failed()) {
            Log::error('Magnific Search Failed', ['status' => $response->status(), 'body' => $response->body()]);
            return ['success' => false, 'items' => [], 'pagination' => ['current_page' => 1, 'has_next' => false, 'next_page' => null]];
        }

        $data = $response->json();
        $items = [];

        foreach ($data['data'] ?? [] as $item) {
            $items[] = $this->normalizeAsset($item);
        }

        return [
            'success' => true,
            'items' => $items,
            'pagination' => [
                'current_page' => (int)($data['meta']['current_page'] ?? $query['page']),
                'has_next' => !empty($data['links']['next']),
                'next_page' => !empty($data['links']['next']) ? ((int)($data['meta']['current_page'] ?? $query['page']) + 1) : null,
            ],
        ];
    }

    public function getCategories(): array
    {
        // Magnific doesn't seem to have a categories endpoint in the provided spec.
        // We will return a static safe list.
        return [
            ['id' => 'photos', 'name' => 'Photos', 'slug' => 'photos'],
            ['id' => 'illustrations', 'name' => 'Illustrations', 'slug' => 'illustrations'],
            ['id' => 'vectors', 'name' => 'Vectors', 'slug' => 'vectors'],
        ];
    }

    public function getAssetDetails(string $id): ?array
    {
        $response = $this->client()->get("/resources/{$id}");

        if ($response->failed()) {
            return null;
        }

        return $this->normalizeAsset($response->json('data') ?? $response->json());
    }

    public function getUseUrl(string $id): array
    {
        // Magnific provides download endpoint: /resources/{resource-id}/download/{resource-format}
        // Assuming format is 'original' or similar based on details, let's just get the details first
        $details = $this->getAssetDetails($id);
        if (!$details) {
            throw new \Exception("Asset not found");
        }

        $response = $this->client()->get("/resources/{$id}/download");
        if ($response->failed()) {
             // Fallback to preview_url if download fails
             return [
                 'url' => $details['preview_url'] ?? $details['thumbnail_url'],
                 'metadata' => $details
             ];
        }

        $data = $response->json();
        $downloadUrl = $data['url'] ?? $data['data']['url'] ?? '';

        // If download URL is a ZIP or EPS, fallback to raster preview
        if (empty($downloadUrl) || preg_match('/\.(zip|eps|ai|rar)(\?.*)?$/i', $downloadUrl)) {
            $downloadUrl = $details['preview_url'] ?? $details['thumbnail_url'] ?? '';
        }

        return [
            'url' => $downloadUrl,
            'metadata' => $details,
        ];
    }

    protected function normalizeAsset(array $item): array
    {
        $id = (string)($item['id'] ?? '');
        $type = $item['type'] ?? 'photo';
        $isVector = in_array($type, ['vector', 'svg', 'illustration']);

        return [
            'id' => "magnific:{$id}",
            'provider' => 'magnific',
            'provider_asset_id' => $id,
            'title' => $item['title'] ?? $item['name'] ?? 'Magnific Asset',
            'asset_type' => $type,
            'category' => [
                'id' => $item['category_id'] ?? 'general',
                'name' => $item['category_name'] ?? 'General',
                'slug' => strtolower($item['category_name'] ?? 'general'),
            ],
            'format' => $isVector ? 'svg' : 'jpg',
            'mime_type' => $isVector ? 'image/svg+xml' : 'image/jpeg',
            'thumbnail_url' => $item['image']['source']['url'] ?? $item['thumbnail']['url'] ?? $item['preview']['url'] ?? $item['preview_url'] ?? '',
            'preview_url' => $item['image']['source']['url'] ?? $item['preview']['url'] ?? $item['preview_url'] ?? '',
            'download_url' => null, // Handled via getUseUrl
            'width' => $item['width'] ?? 1000,
            'height' => $item['height'] ?? 1000,
            'is_vector' => $isVector,
            'is_recolourable' => $isVector,
            'attribution' => $item['attribution'] ?? null,
            'license' => $item['license'] ?? null,
            'metadata' => $item,
        ];
    }
}
