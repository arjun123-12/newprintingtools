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
    public function useAsset(string $id, ?string $requestedFormat = null): array
    {
        $details = $this->resourceService->getDetails($id);
        $format = $this->resolveRequestedFormat($requestedFormat, $details);
        $isPsd = $format === 'psd';
        $downloadEndpoint = $isPsd
            ? "/resources/{$id}/download/psd"
            : "/resources/{$id}/download";

        $response = null;

        try {
            $response = $this->client
                ->client()
                ->get($downloadEndpoint);
        } catch (Throwable $exception) {
            Log::error('Freepik download request failed.', [
                'resource_id' => $id,
                'format' => $format,
                'error' => $exception->getMessage(),
            ]);

            throw new RuntimeException(
                'Could not connect to the Freepik download API.',
                502,
                $exception
            );
        }

        if (!$response->successful()) {
            Log::warning('Freepik download request was unsuccessful.', [
                'resource_id' => $id,
                'format' => $format,
                'status' => $response->status(),
                'body' => Str::limit($response->body(), 1000),
            ]);

            throw new RuntimeException(
                $this->getFreepikDownloadErrorMessage($response, $isPsd),
                $this->normaliseHttpStatus($response->status())
            );
        }

        $remoteUrl = $this->extractDownloadUrl($response);

        // Some download endpoints return the file directly instead of JSON.
        if ($remoteUrl === null && !$this->isJsonResponse($response)) {
            $storedAsset = $isPsd
                ? $this->storePsdBytes(
                    $response->body(),
                    "designer/freepik/{$id}"
                )
                : $this->storeRasterBytes(
                    $response->body(),
                    (string) ($response->header('Content-Type') ?? ''),
                    "designer/freepik/{$id}"
                );
        } elseif ($remoteUrl !== null) {
            $storedAsset = $isPsd
                ? $this->storeRemotePsd(
                    $remoteUrl,
                    "designer/freepik/{$id}"
                )
                : $this->storeRemoteImage(
                    $remoteUrl,
                    "designer/freepik/{$id}"
                );
        } elseif ($isPsd) {
            // Never silently replace a requested layered PSD with a preview.
            throw new RuntimeException(
                'Freepik did not return an original PSD download URL. Check that your API account can download PSD resources.',
                422
            );
        } else {
            $previewUrl = $this->getRasterPreviewUrl($details);

            if ($previewUrl === null) {
                throw new RuntimeException(
                    'Could not retrieve a renderable Freepik image URL.',
                    404
                );
            }

            $storedAsset = $this->storeRemoteImage(
                $previewUrl,
                "designer/freepik/{$id}"
            );
        }

        return [
            'id' => (string) $id,
            'url' => $storedAsset['url'],
            'file_url' => $storedAsset['url'],
            'original_url' => $storedAsset['url'],
            'file_path' => $storedAsset['path'],
            'mime_type' => $storedAsset['mime_type'],
            'file_format' => $isPsd ? 'psd' : $storedAsset['extension'],
            'title' => $details['title']
                ?? $details['name']
                ?? 'Freepik Asset',
            'type' => $isPsd
                ? 'psd'
                : ($details['content_type']
                    ?? $details['type']
                    ?? 'photo'),
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
            $http = Http::acceptJson()
                ->asForm()
                ->withHeaders([
                    'x-magnific-api-key' => $apiKey,
                ])
                ->connectTimeout(20)
                ->timeout(120)
                ->retry(2, 500);

            if (app()->environment('local')) {
                $http = $http->withoutVerifying();
            }

            $response = $http->post(
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
            'png',
            'public'
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
        ?string $forcedExtension = null,
        ?string $diskName = null
    ): array {
        $this->ensurePublicHttpUrl($remoteUrl);

        try {
            $http = Http::accept('image/*')
                ->connectTimeout(20)
                ->timeout(120)
                ->retry(2, 500);

            if (app()->environment('local')) {
                $http = $http->withoutVerifying();
            }

            $response = $http->get($remoteUrl);
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
            (string) ($response->header('Content-Type') ?? '')
        )[0]));

        $allowedMimeTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'image/x-png' => 'png',
            'application/octet-stream' => 'png',
            'binary/octet-stream' => 'png',
        ];

        if (!isset($allowedMimeTypes[$mimeType]) && empty($forcedExtension)) {
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
        if (strlen($body) > $this->maximumAssetBytes()) {
            throw new RuntimeException(
                'The downloaded image exceeds the configured file-size limit.',
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

        // Background-removal results must use the public disk because
        // DesignerController::serveRemovedBackground() reads from that disk.
        // Other Freepik downloads keep using the application's configured
        // default disk unless a disk is explicitly supplied by the caller.
        $disk = $diskName !== null && trim($diskName) !== ''
            ? trim($diskName)
            : (string) config('filesystems.default', 'public');

        if (!Storage::disk($disk)->put($path, $body)) {
            throw new RuntimeException(
                'The downloaded image could not be stored.',
                500
            );
        }

        // Do not return a URL unless the file genuinely exists. This prevents
        // the frontend from receiving a plausible /storage URL for a file that
        // was never persisted or was written to a different disk.
        if (!Storage::disk($disk)->exists($path)) {
            throw new RuntimeException(
                'The downloaded image was not found after it was stored.',
                500
            );
        }

        $storedSize = Storage::disk($disk)->size($path);

        if (!is_int($storedSize) || $storedSize <= 0) {
            Storage::disk($disk)->delete($path);

            throw new RuntimeException(
                'The stored image is empty.',
                500
            );
        }

        return [
            'path' => $path,
            'url' => Storage::disk($disk)->url($path),
            'mime_type' => $mimeType,
            'extension' => $extension,
        ];
    }

    /**
     * Download an original PSD. Freepik may return either a raw PSD or a ZIP
     * containing the PSD, so both formats are handled without exposing the
     * provider API key to the browser.
     */
    private function storeRemotePsd(string $remoteUrl, string $directory): array
    {
        $this->ensurePublicHttpUrl($remoteUrl);

        try {
            $http = Http::accept('*/*')
                ->connectTimeout(20)
                ->timeout(300)
                ->retry(2, 750);

            if (app()->environment('local')) {
                $http = $http->withoutVerifying();
            }

            $response = $http->get($remoteUrl);
        } catch (Throwable $exception) {
            throw new RuntimeException(
                'Could not download the original PSD file.',
                502,
                $exception
            );
        }

        if ($response->failed()) {
            throw new RuntimeException(
                'The original PSD download failed with status '
                    . $response->status()
                    . '.',
                502
            );
        }

        return $this->storePsdBytes($response->body(), $directory);
    }

    private function storePsdBytes(string $body, string $directory): array
    {
        if ($body === '') {
            throw new RuntimeException('The downloaded PSD is empty.', 502);
        }

        if (strlen($body) > $this->maximumAssetBytes()) {
            throw new RuntimeException(
                'The downloaded PSD exceeds the configured file-size limit.',
                422
            );
        }

        if (substr($body, 0, 4) === "PK\x03\x04") {
            $body = $this->extractPsdFromZip($body);
        }

        if (substr($body, 0, 4) !== '8BPS') {
            throw new RuntimeException(
                'Freepik returned a preview or unsupported file instead of an original PSD.',
                422
            );
        }

        $path = trim($directory, '/')
            . '/'
            . Str::uuid()
            . '.psd';
        $disk = (string) config('filesystems.default', 'public');

        if (!Storage::disk($disk)->put($path, $body)) {
            throw new RuntimeException(
                'The downloaded PSD could not be stored.',
                500
            );
        }

        return [
            'path' => $path,
            'url' => Storage::disk($disk)->url($path),
            'mime_type' => 'image/vnd.adobe.photoshop',
            'extension' => 'psd',
        ];
    }

    private function extractPsdFromZip(string $zipBytes): string
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new RuntimeException(
                'PHP ZipArchive is required to extract Freepik PSD downloads.',
                500
            );
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'freepik_psd_');

        if ($temporaryPath === false) {
            throw new RuntimeException(
                'Could not create a temporary file for PSD extraction.',
                500
            );
        }

        try {
            if (file_put_contents($temporaryPath, $zipBytes) === false) {
                throw new RuntimeException(
                    'Could not prepare the PSD archive for extraction.',
                    500
                );
            }

            $zip = new \ZipArchive();
            $opened = $zip->open($temporaryPath);

            if ($opened !== true) {
                throw new RuntimeException(
                    'The downloaded PSD archive is invalid.',
                    422
                );
            }

            try {
                for ($index = 0; $index < $zip->numFiles; $index++) {
                    $stat = $zip->statIndex($index);
                    $name = is_array($stat) ? (string) ($stat['name'] ?? '') : '';
                    $size = is_array($stat) ? (int) ($stat['size'] ?? 0) : 0;

                    if (!preg_match('/\.psd$/i', $name)) {
                        continue;
                    }

                    if ($size <= 0 || $size > $this->maximumAssetBytes()) {
                        throw new RuntimeException(
                            'The PSD inside the archive exceeds the configured file-size limit.',
                            422
                        );
                    }

                    $psdBytes = $zip->getFromIndex($index);

                    if (
                        !is_string($psdBytes)
                        || substr($psdBytes, 0, 4) !== '8BPS'
                    ) {
                        throw new RuntimeException(
                            'The archive does not contain a valid PSD file.',
                            422
                        );
                    }

                    return $psdBytes;
                }
            } finally {
                $zip->close();
            }
        } finally {
            @unlink($temporaryPath);
        }

        throw new RuntimeException(
            'The downloaded archive does not contain a PSD file.',
            422
        );
    }

    private function storeRasterBytes(
        string $body,
        string $contentType,
        string $directory
    ): array {
        $mimeType = strtolower(trim(explode(';', $contentType)[0]));
        $allowedMimeTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];

        if (!isset($allowedMimeTypes[$mimeType])) {
            throw new RuntimeException(
                'Freepik returned an unsupported image format.',
                422
            );
        }

        if ($body === '' || strlen($body) > $this->maximumAssetBytes()) {
            throw new RuntimeException(
                'The downloaded image is empty or exceeds the configured file-size limit.',
                422
            );
        }

        $extension = $allowedMimeTypes[$mimeType];
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
            'extension' => $extension,
        ];
    }

    private function resolveRequestedFormat(
        ?string $requestedFormat,
        array $details
    ): ?string {
        $candidate = strtolower(trim((string) (
            $requestedFormat
            ?? $details['content_type']
            ?? $details['type']
            ?? $details['image']['type']
            ?? ''
        )));

        return str_contains($candidate, 'psd') ? 'psd' : null;
    }

    private function extractDownloadUrl(Response $response): ?string
    {
        if (!$this->isJsonResponse($response)) {
            return null;
        }

        $candidates = [
            $response->json('data.url'),
            $response->json('data.download_url'),
            $response->json('url'),
            $response->json('download_url'),
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && filter_var($candidate, FILTER_VALIDATE_URL)) {
                return $candidate;
            }
        }

        return null;
    }

    private function isJsonResponse(Response $response): bool
    {
        return str_contains(
            strtolower((string) ($response->header('Content-Type') ?? '')),
            'json'
        );
    }

    private function maximumAssetBytes(): int
    {
        $megabytes = max(
            1,
            (int) config('services.freepik.max_download_mb', 100)
        );

        return $megabytes * 1024 * 1024;
    }

    private function getFreepikDownloadErrorMessage(
        Response $response,
        bool $isPsd
    ): string {
        $message = $response->json('message')
            ?? $response->json('error.message')
            ?? $response->json('error')
            ?? null;

        if (is_string($message) && $message !== '') {
            return $message;
        }

        return $isPsd
            ? 'Freepik could not provide the original PSD. Verify your download entitlement and API plan.'
            : 'Freepik could not provide the requested asset.';
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
