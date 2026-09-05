<?php

namespace App\Services\ExternalAssets\Providers;

use App\Services\ExternalAssets\ExternalAssetProviderInterface;
use App\Services\Freepik\FreepikResourceService;
use App\Services\Freepik\FreepikDownloadService;

class FreepikAssetProvider implements ExternalAssetProviderInterface
{
    protected FreepikResourceService $freepikResourceService;
    protected FreepikDownloadService $freepikDownloadService;

    public function __construct(
        FreepikResourceService $freepikResourceService,
        FreepikDownloadService $freepikDownloadService
    ) {
        $this->freepikResourceService = $freepikResourceService;
        $this->freepikDownloadService = $freepikDownloadService;
    }

    public function getProviderName(): string
    {
        return 'freepik';
    }

    public function search(array $params): array
    {
        $freepikParams = [
            'q' => $params['query'] ?? '',
            'type' => $params['asset_type'] ?? 'all',
            'page' => $params['page'] ?? 1,
            'limit' => $params['per_page'] ?? 30,
        ];

        try {
            $data = $this->freepikResourceService->search($freepikParams);
            
            $items = [];
            foreach ($data['items'] ?? [] as $item) {
                $items[] = $this->normalizeAsset($item);
            }

            return [
                'success' => true,
                'items' => $items,
                'pagination' => [
                    'current_page' => $data['pagination']['page'] ?? 1,
                    'has_next' => $data['pagination']['has_next'] ?? false,
                    'next_page' => ($data['pagination']['has_next'] ?? false) ? (($data['pagination']['page'] ?? 1) + 1) : null,
                ],
            ];
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Freepik Provider Search Error', ['error' => $e->getMessage()]);
            return [
                'success' => false,
                'items' => [],
                'pagination' => ['current_page' => 1, 'has_next' => false, 'next_page' => null],
            ];
        }
    }

    public function getCategories(): array
    {
        return [
            ['id' => 'all', 'name' => 'All', 'slug' => 'all'],
            ['id' => 'vectors', 'name' => 'Vectors', 'slug' => 'vectors'],
            ['id' => 'photos', 'name' => 'Photos', 'slug' => 'photos'],
            ['id' => 'icons', 'name' => 'Icons', 'slug' => 'icons'],
        ];
    }

    public function getAssetDetails(string $id): ?array
    {
        try {
            $data = $this->freepikResourceService->getDetails($id);
            return $this->normalizeAsset($data);
        } catch (\Exception $e) {
            return null;
        }
    }

    public function getUseUrl(string $id): array
    {
        try {
            $data = $this->freepikDownloadService->useAsset($id);
            $details = $this->getAssetDetails($id);
            
            return [
                'url' => $data['url'] ?? $details['preview_url'] ?? '',
                'metadata' => $details ?? [],
            ];
        } catch (\Exception $e) {
            // Fallback for download/use
            $details = $this->getAssetDetails($id);
            if ($details) {
                 return [
                     'url' => $details['preview_url'] ?? $details['thumbnail_url'],
                     'metadata' => $details,
                 ];
            }
            throw $e;
        }
    }

    protected function normalizeAsset(array $item): array
    {
        $id = (string)($item['id'] ?? '');
        $type = $item['type'] ?? 'photo';
        $isVector = in_array($type, ['vector', 'svg', 'icon']);

        return [
            'id' => "freepik:{$id}",
            'provider' => 'freepik',
            'provider_asset_id' => $id,
            'title' => $item['title'] ?? 'Freepik Asset',
            'asset_type' => $type,
            'category' => [
                'id' => $type,
                'name' => ucfirst($type),
                'slug' => $type,
            ],
            'format' => $isVector ? 'svg' : 'jpg',
            'mime_type' => $isVector ? 'image/svg+xml' : 'image/jpeg',
            'thumbnail_url' => $item['thumbnail_url'] ?? $item['preview_url'] ?? '',
            'preview_url' => $item['preview_url'] ?? '',
            'download_url' => $item['source_url'] ?? null,
            'width' => 1000,
            'height' => 1000,
            'is_vector' => $isVector,
            'is_recolourable' => $isVector,
            'attribution' => $item['author']['name'] ?? 'Freepik',
            'license' => $item['license'] ?? null,
            'metadata' => $item,
        ];
    }
}
