<?php

namespace App\Services\Freepik;

use Illuminate\Support\Facades\Log;

class FreepikIconService
{
    protected FreepikClient $client;

    public function __construct(FreepikClient $client)
    {
        $this->client = $client;
    }

    /**
     * Search Freepik / Magnific icons.
     *
     * @param array $params
     * @return array
     */
    public function searchIcons(array $params): array
    {
        // Add query parameters for pagination and search
        $queryParams = [
            'order' => 'relevance',
        ];
        
        if (!empty($params['q'])) {
            $queryParams['term'] = $params['q'];
        }
        if (!empty($params['page'])) {
            $queryParams['page'] = $params['page'];
        }
        if (!empty($params['limit'])) {
            $queryParams['limit'] = $params['limit'];
        }

        $response = $this->client->client()->get('/icons', $queryParams);

        if ($response->failed()) {
            Log::error('Freepik API icon search failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('Failed to search icons from Freepik API');
        }

        $data = $response->json();
        
        $items = [];
        if (isset($data['data'])) {
            foreach ($data['data'] as $item) {
                $items[] = [
                    'id' => (string) $item['id'],
                    'title' => $item['name'] ?? $item['title'] ?? 'Untitled Icon',
                    'type' => 'icon',
                    'preview_url' => $item['thumbnails'][0]['url'] ?? $item['image']['source']['url'] ?? '',
                    'thumbnail_url' => $item['thumbnails'][0]['url'] ?? $item['image']['source']['url'] ?? '',
                    'source_url' => $item['url'] ?? '',
                    'author' => [
                        'name' => $item['author']['name'] ?? 'Unknown',
                        'url' => ''
                    ],
                    'license' => [
                        'type' => 'freepik',
                        'requires_attribution' => true
                    ],
                    'provider' => 'freepik',
                ];
            }
        }

        return [
            'items' => $items,
            'pagination' => [
                'page' => (int) ($params['page'] ?? 1),
                'limit' => (int) ($params['limit'] ?? 20),
                'total_items' => $data['meta']['total'] ?? count($items),
                'total_pages' => isset($data['meta']['total']) && isset($params['limit']) 
                    ? ceil($data['meta']['total'] / $params['limit']) 
                    : 1,
                'has_next' => isset($data['meta']['total_pages']) && ((int)($params['page'] ?? 1) < $data['meta']['total_pages'])
            ]
        ];
    }

    /**
     * Download an icon from Freepik/Magnific and return its URL and metadata for Fabric.js.
     *
     * @param string $id
     * @return array
     */
    public function useIcon(string $id): array
    {
        // Trigger a download from Freepik to register the usage and get the hi-res URL
        $response = $this->client->client()->get("/icons/{$id}/download", [
            'png_size' => 512,
        ]);

        if ($response->failed()) {
            Log::error('Freepik API icon download failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'id' => $id,
            ]);

            // If insufficient credits (402) or other error, fallback to fetching details
            if ($response->status() === 402 || $response->status() >= 400) {
                $detailsResponse = $this->client->client()->get("/icons/{$id}");
                if ($detailsResponse->successful()) {
                    $detailsData = $detailsResponse->json();
                    $url = $detailsData['data']['thumbnails'][0]['url'] 
                        ?? $detailsData['data']['image']['source']['url'] 
                        ?? $detailsData['data']['url'] 
                        ?? null;
                        
                    if ($url) {
                        return [
                            'id' => $id,
                            'url' => $url,
                            'title' => 'Icon ' . $id,
                            'type' => 'icon',
                            'provider' => 'freepik',
                        ];
                    }
                }
            }
            
            throw new \Exception('Failed to download icon from Freepik API');
        }

        $data = $response->json();

        // Magnific API usually returns a URL directly in the data or data['url']
        $url = $data['data']['url'] ?? $data['url'] ?? null;
        
        if (!$url) {
            throw new \Exception('No URL found in Freepik icon download response');
        }

        return [
            'id' => $id,
            'url' => $url,
            'title' => 'Icon ' . $id,
            'type' => 'icon',
            'provider' => 'freepik',
        ];
    }
}
