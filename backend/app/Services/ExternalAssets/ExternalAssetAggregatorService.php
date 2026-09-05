<?php

namespace App\Services\ExternalAssets;

use App\Services\ExternalAssets\Providers\FreepikAssetProvider;
use App\Services\ExternalAssets\Providers\MagnificAssetProvider;
use Illuminate\Support\Facades\Cache;

class ExternalAssetAggregatorService
{
    protected array $providers = [];

    public function __construct(
        FreepikAssetProvider $freepikProvider,
        MagnificAssetProvider $magnificProvider
    ) {
        $this->providers = [
            $freepikProvider->getProviderName() => $freepikProvider,
            $magnificProvider->getProviderName() => $magnificProvider,
        ];
    }

    public function getCategories(): array
    {
        return Cache::remember('external_assets:categories', 3600, function () {
            $categories = [];
            foreach ($this->providers as $provider) {
                try {
                    $providerCats = $provider->getCategories();
                    foreach ($providerCats as $cat) {
                        // Very simple merge strategy
                        $slug = $cat['slug'];
                        if (!isset($categories[$slug])) {
                            $categories[$slug] = $cat;
                        }
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to fetch categories for {$provider->getProviderName()}", ['error' => $e->getMessage()]);
                }
            }
            return array_values($categories);
        });
    }

    public function search(array $params): array
    {
        $cacheKey = 'external_assets:search:' . md5(json_encode($params));

        return Cache::remember($cacheKey, 300, function () use ($params) {
            $providerFilter = $params['provider'] ?? 'all';
            $results = [
                'items' => [],
                'pagination' => [
                    'current_page' => $params['page'] ?? 1,
                    'has_next' => false,
                    'next_page' => null,
                ],
                'providers' => [],
            ];

            $providersToSearch = [];
            if ($providerFilter === 'all') {
                $providersToSearch = $this->providers;
            } elseif (isset($this->providers[$providerFilter])) {
                $providersToSearch = [$this->providers[$providerFilter]];
            }

            foreach ($providersToSearch as $name => $provider) {
                try {
                    $providerResults = $provider->search($params);
                    $results['items'] = array_merge($results['items'], $providerResults['items'] ?? []);
                    $results['providers'][$name] = [
                        'success' => $providerResults['success'] ?? false,
                        'has_next' => $providerResults['pagination']['has_next'] ?? false,
                    ];
                    
                    if ($providerResults['pagination']['has_next'] ?? false) {
                        $results['pagination']['has_next'] = true;
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error("Provider search failed: {$name}", ['error' => $e->getMessage()]);
                    $results['providers'][$name] = [
                        'success' => false,
                        'has_next' => false,
                        'error' => $e->getMessage(),
                    ];
                }
            }

            if ($results['pagination']['has_next']) {
                $results['pagination']['next_page'] = $results['pagination']['current_page'] + 1;
            }

            // Shuffle slightly to interleave results from multiple providers when 'all'
            if ($providerFilter === 'all') {
                shuffle($results['items']);
            }

            return ['success' => true, 'data' => $results];
        });
    }

    public function getAssetDetails(string $providerName, string $id): ?array
    {
        if (!isset($this->providers[$providerName])) {
            throw new \InvalidArgumentException("Unknown provider: {$providerName}");
        }

        return $this->providers[$providerName]->getAssetDetails($id);
    }

    public function getUseUrl(string $providerName, string $id): array
    {
        if (!isset($this->providers[$providerName])) {
            throw new \InvalidArgumentException("Unknown provider: {$providerName}");
        }

        return $this->providers[$providerName]->getUseUrl($id);
    }
}
