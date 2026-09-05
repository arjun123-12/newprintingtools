<?php

namespace App\Services\ExternalAssets;

interface ExternalAssetProviderInterface
{
    /**
     * Get the unique provider identifier (e.g. 'freepik', 'magnific')
     */
    public function getProviderName(): string;

    /**
     * Search for assets
     * 
     * @param array $params Contains query, category, asset_type, format, page, per_page, etc.
     * @return array Normalized array with 'items', 'pagination', and 'success'
     */
    public function search(array $params): array;

    /**
     * Get provider categories
     * 
     * @return array List of normalized categories
     */
    public function getCategories(): array;

    /**
     * Get details for a specific asset
     * 
     * @param string $id
     * @return array|null Normalized asset details or null if not found
     */
    public function getAssetDetails(string $id): ?array;

    /**
     * Retrieve a usable URL and metadata for adding to the canvas
     * 
     * @param string $id
     * @return array Contains 'url', 'metadata' (including attribution, license)
     */
    public function getUseUrl(string $id): array;
}
