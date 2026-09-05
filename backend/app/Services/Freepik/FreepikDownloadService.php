<?php

namespace App\Services\Freepik;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class FreepikDownloadService
{
    public function __construct(
        protected FreepikClient $client,
        protected FreepikResourceService $resourceService
    ) {
    }

    /**
     * Download a Freepik asset into permanent application storage.
     *
     * Fabric.js must receive the stored URL, not a temporary Freepik URL.
     */
    public function useAsset(string $id): array
    {
        $details = $this->resourceService->getDetails($id);
        $remoteUrl = null;

        try {
            $response = $this->client
                ->client()
                ->get("/resources/{$id}/download");

            if ($response->successful()) {
                $remoteUrl = $response->json('data.url');
            } else {
                Log::warning('Freepik download request was unsuccessful.', [
                    'resource_id' => $id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (Throwable $exception) {
            Log::warning('Freepik download request failed.', [
                'resource_id' => $id,
                'error' => $exception->getMessage(),
            ]);
        }

        // ZIP, EPS, AI and RAR files cannot be rendered by Fabric.js.
        if (!$remoteUrl || $this->isUnsupportedArtworkUrl($remoteUrl)) {
            $remoteUrl = $this->getRasterPreviewUrl($details);
        }

        if (!$remoteUrl) {
            throw new RuntimeException(
                'Could not retrieve a renderable Freepik image URL.',
                404
            );
        }

        try {
            $storedImage = $this->storeRemoteImage(
                $remoteUrl,
                "designer/freepik/{$id}"
            );
        } catch (RuntimeException $exception) {
            // A download endpoint can return a ZIP even when its URL has no
            // extension. In that case, store the raster preview instead.
            $previewUrl = $this->getRasterPreviewUrl($details);

            if (!$previewUrl || $previewUrl === $remoteUrl) {
                throw $exception;
            }

            $storedImage = $this->storeRemoteImage(
                $previewUrl,
                "designer/freepik/{$id}"
            );
        }

        return [
            'id' => (string) $id,
            'url' => $storedImage['url'],
            'file_url' => $storedImage['url'],
            'file_path' => $storedImage['path'],
            'mime_type' => $storedImage['mime_type'],
            'title' => $details['title']
                ?? $details['name']
                ?? 'Freepik Asset',
            'type' => $details['content_type']
                ?? $details['type']
                ?? 'photo',
            'provider' => 'freepik',
            'provider_asset_id' => (string) $id,
        ];
    }

    /**
     * Remove an image background using Magnific and permanently save the
     * short-lived result returned by Magnific.
     */
    public function removeBackground(string $imageUrl): array
    {
        $apiKey = (string) config('services.magnific.api_key');
        $apiUrl = rtrim(
            (string) config(
                'services.magnific.api_url',
                'https://api.magnific.com/v1'
            ),
            '/'
        );

        if ($apiKey === '') {
            throw new RuntimeException(
                'Magnific API key is not configured.',
                500
            );
        }

        $this->ensurePublicHttpUrl($imageUrl);

        try {
            $response = Http::acceptJson()
                ->asForm()
                ->withHeaders([
                    'x-magnific-api-key' => $apiKey,
                ])
                ->connectTimeout(20)
                ->timeout(120)
                ->retry(2, 500)
                ->post(
                    $apiUrl . '/ai/beta/remove-background',
                    ['image_url' => $imageUrl]
                );
        } catch (Throwable $exception) {
            Log::error('Magnific remove-background connection failed.', [
                'error' => $exception->getMessage(),
            ]);

            throw new RuntimeException(
                'Could not connect to the Magnific API.',
                502,
                $exception
            );
        }

        if ($response->failed()) {
            Log::error('Magnific remove-background request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new RuntimeException(
                $this->getApiErrorMessage($response),
                $this->normaliseHttpStatus($response->status())
            );
        }

        $payload = $response->json();

        if (!is_array($payload)) {
            throw new RuntimeException(
                'Magnific returned an invalid JSON response.',
                502
            );
        }

        // Support both top-level and { data: {...} } response formats.
        $data = isset($payload['data']) && is_array($payload['data'])
            ? $payload['data']
            : $payload;

        $temporaryUrl = $data['high_resolution']
            ?? $data['url']
            ?? $data['preview']
            ?? null;

        if (!is_string($temporaryUrl) || $temporaryUrl === '') {
            Log::error('Magnific response has no result URL.', [
                'response' => $payload,
            ]);

            throw new RuntimeException(
                'Magnific did not return a processed image URL.',
                502
            );
        }

        // Magnific result URLs expire quickly, so save the file immediately.
        $storedImage = $this->storeRemoteImage(
            $temporaryUrl,
            'designer/removed-backgrounds',
            'png'
        );

        return [
            'url' => $storedImage['url'],
            'file_url' => $storedImage['url'],
            'file_path' => $storedImage['path'],
            'mime_type' => $storedImage['mime_type'],
            'original' => $data['original'] ?? $imageUrl,
        ];
    }

    /**
     * Download a remote raster image and save it to the configured disk.
     */
    private function storeRemoteImage(
        string $remoteUrl,
        string $directory,
        ?string $forcedExtension = null
    ): array {
        try {
            $response = Http::accept('image/*')
                ->connectTimeout(20)
                ->timeout(120)
                ->retry(2, 500)
                ->get($remoteUrl);
        } catch (Throwable $exception) {
            throw new RuntimeException(
                'Could not download the remote image.',
                502,
                $exception
            );
        }

        if ($response->failed()) {
            throw new RuntimeException(
                'The remote image download failed with status '
                    . $response->status()
                    . '.',
                502
            );
        }

        $mimeType = strtolower(trim(explode(
            ';',
            (string) $response->header('Content-Type', '')
        )[0]));

        $allowedMimeTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];

        if (!isset($allowedMimeTypes[$mimeType])) {
            throw new RuntimeException(
                'The remote resource is not a supported raster image.',
                422
            );
        }

        $body = $response->body();

        if ($body === '') {
            throw new RuntimeException(
                'The downloaded image is empty.',
                502
            );
        }

        // Prevent unexpectedly large remote files from filling storage.
        if (strlen($body) > 20 * 1024 * 1024) {
            throw new RuntimeException(
                'The downloaded image exceeds the 20 MB limit.',
                422
            );
        }

        $extension = $forcedExtension
            ?? $allowedMimeTypes[$mimeType];

        $path = trim($directory, '/')
            . '/'
            . Str::uuid()
            . '.'
            . $extension;

        $disk = (string) config('filesystems.default', 'public');

        if (!Storage::disk($disk)->put($path, $body)) {
            throw new RuntimeException(
                'The downloaded image could not be stored.',
                500
            );
        }

        return [
            'path' => $path,
            'url' => Storage::disk($disk)->url($path),
            'mime_type' => $mimeType,
        ];
    }

    private function getRasterPreviewUrl(array $details): ?string
    {
        $url = $details['image']['source']['url']
            ?? $details['preview']['url']
            ?? $details['image']['url']
            ?? null;

        return is_string($url) && $url !== '' ? $url : null;
    }

    private function isUnsupportedArtworkUrl(string $url): bool
    {
        $path = (string) parse_url($url, PHP_URL_PATH);

        return preg_match('/\.(zip|eps|ai|rar)$/i', $path) === 1;
    }

    private function ensurePublicHttpUrl(string $url): void
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new RuntimeException(
                'The image URL is invalid.',
                422
            );
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new RuntimeException(
                'The image must use an HTTP or HTTPS URL.',
                422
            );
        }

        if (
            $host === ''
            || $host === 'localhost'
            || $host === '127.0.0.1'
            || $host === '::1'
        ) {
            throw new RuntimeException(
                'Magnific requires a publicly accessible image URL.',
                422
            );
        }

        if (
            filter_var($host, FILTER_VALIDATE_IP)
            && !filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            )
        ) {
            throw new RuntimeException(
                'Private network image URLs are not allowed.',
                422
            );
        }
    }

    private function getApiErrorMessage(Response $response): string
    {
        $message = $response->json('message')
            ?? $response->json('error.message')
            ?? $response->json('error')
            ?? null;

        return is_string($message) && $message !== ''
            ? $message
            : 'Magnific failed to remove the image background.';
    }

    private function normaliseHttpStatus(int $status): int
    {
        return $status >= 400 && $status <= 599
            ? $status
            : 502;
    }
}
