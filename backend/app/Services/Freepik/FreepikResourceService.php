<?php

namespace App\Services\Freepik;

use Illuminate\Support\Facades\Log;

class FreepikResourceService
{
    protected FreepikClient $client;

    public function __construct(FreepikClient $client)
    {
        $this->client = $client;
    }

    /**
     * Search Freepik resources.
     *
     * @param array $params
     * @return array
     */
    public function search(array $params): array
    {
        // Since Magnific API doesn't filter by content_type natively,
        // we fetch more items and filter them locally.
        $fetchLimit = 100; // Fetch a larger pool to guarantee enough filtered results
        $requestedType = $params['type'] ?? 'all';

        $response = $this->client->client()->get('/resources', [
            'locale' => 'en-US',
            'term' => $params['q'] ?? '',
            'page' => $params['page'] ?? 1, // Note: standard pagination might be slightly inaccurate due to local filtering
            'limit' => $fetchLimit,
        ]);

        if ($response->failed()) {
            Log::error('Freepik API search failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \Exception($this->getErrorMessage($response->status()), $response->status());
        }

        $data = $response->json();

        // Normalize response
        $items = [];
        if (isset($data['data'])) {
            foreach ($data['data'] as $item) {
                $itemType = $item['image']['type'] ?? 'photo';
                
                // Local Filtering Logic
                if ($requestedType !== 'all') {
                    if ($requestedType === 'photo' && !in_array($itemType, ['photo', 'psd'])) {
                        continue;
                    }
                    if ($requestedType === 'vector' && $itemType !== 'vector') {
                        continue;
                    }
                    if ($requestedType === 'icon' && $itemType !== 'icon') {
                        continue;
                    }
                }

                $items[] = [
                    'id' => (string) $item['id'],
                    'title' => $item['title'] ?? 'Untitled',
                    'type' => $itemType,
                    'preview_url' => $item['image']['source']['url'] ?? '',
                    'thumbnail_url' => $item['image']['source']['url'] ?? '',
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

        // Apply local limit to the filtered results
        $requestedLimit = (int) ($params['limit'] ?? 20);
        $slicedItems = array_slice($items, 0, $requestedLimit);
        $hasNext = count($items) > $requestedLimit;

        return [
            'items' => $slicedItems,
            'pagination' => [
                'page' => (int) ($params['page'] ?? 1),
                'limit' => $requestedLimit,
                'total_items' => count($items),
                'total_pages' => $hasNext ? ((int) ($params['page'] ?? 1)) + 1 : (int) ($params['page'] ?? 1),
                'has_next' => $hasNext,
                'has_prev' => ((int) ($params['page'] ?? 1)) > 1
            ]
        ];
    }

    /**
     * Get resource details.
     *
     * @param string $id
     * @return array
     */
    public function getDetails(string $id): array
    {
        $response = $this->client->client()->get("/resources/{$id}");

        if ($response->failed()) {
            Log::error('Freepik API get details failed', [
                'status' => $response->status(),
                'resource_id' => $id,
                'body' => $response->body(),
            ]);

            throw new \Exception($this->getErrorMessage($response->status()), $response->status());
        }

        return $response->json('data') ?? [];
    }

    /**
     * Helper to get user-friendly error message based on status code.
     */
    protected function getErrorMessage(int $status): string
    {
        return match ($status) {
            401, 403 => 'Freepik authentication failed.',
            404 => 'Freepik asset not found.',
            429 => 'Freepik request limit reached. Please try again shortly.',
            default => 'Freepik service is temporarily unavailable.',
        };
    }
}
