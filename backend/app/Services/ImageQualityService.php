<?php

namespace App\Services;

use App\Models\DesignImage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

class ImageQualityService
{
    public const PRESET_WEB = 'web';
    public const PRESET_STANDARD = 'standard';
    public const PRESET_PRINT = 'print';
    public const PRESET_ULTRA = 'ultra';
    public const PRESET_CUSTOM = 'custom';

    public const PRESET_DPIS = [
        self::PRESET_WEB => 72,
        self::PRESET_STANDARD => 150,
        self::PRESET_PRINT => 300,
        self::PRESET_ULTRA => 600,
    ];

    /**
     * Resolve target DPI from quality preset or custom value.
     */
    public function resolveTargetDpi(string $preset, ?int $customDpi = null): int
    {
        $preset = strtolower($preset);

        if ($preset === self::PRESET_CUSTOM && $customDpi !== null) {
            return max(50, min(1200, $customDpi));
        }

        return self::PRESET_DPIS[$preset] ?? 300;
    }

    /**
     * Calculate effective DPI according to the exact Fabric.js displayed print dimensions formula.
     *
     * @param float $sourceWidth Natural image pixel width
     * @param float $sourceHeight Natural image pixel height
     * @param float $objectWidth Fabric object width in canvas px
     * @param float $objectHeight Fabric object height in canvas px
     * @param float $scaleX Fabric scaleX
     * @param float $scaleY Fabric scaleY
     * @param float $canvasWidthPx Total canvas width in px
     * @param float $canvasHeightPx Total canvas height in px
     * @param float $documentWidthMm Document width in millimeters
     * @param float $documentHeightMm Document height in millimeters
     * @param array<string, mixed> $crop Crop parameters if any (cropX, cropY, cropWidth, cropHeight)
     * @return array{effective_dpi: float, printed_width_in: float, printed_height_in: float}
     */
    public function calculateEffectiveDpi(
        float $sourceWidth,
        float $sourceHeight,
        float $objectWidth,
        float $objectHeight,
        float $scaleX,
        float $scaleY,
        float $canvasWidthPx,
        float $canvasHeightPx,
        float $documentWidthMm,
        float $documentHeightMm,
        array $crop = []
    ): array {
        // Account for crop if specified
        $effectiveSourceWidth = $sourceWidth;
        $effectiveSourceHeight = $sourceHeight;

        if (!empty($crop['cropWidth']) && $crop['cropWidth'] > 0 && !empty($crop['cropHeight']) && $crop['cropHeight'] > 0) {
            $effectiveSourceWidth = (float) $crop['cropWidth'];
            $effectiveSourceHeight = (float) $crop['cropHeight'];
        }

        // Avoid division by zero
        $canvasWidthPx = max(1.0, $canvasWidthPx);
        $canvasHeightPx = max(1.0, $canvasHeightPx);
        $documentWidthMm = max(1.0, $documentWidthMm);
        $documentHeightMm = max(1.0, $documentHeightMm);

        $displayedWidthPx = max(1.0, abs($objectWidth * $scaleX));
        $displayedHeightPx = max(1.0, abs($objectHeight * $scaleY));

        $displayedWidthMm = ($displayedWidthPx / $canvasWidthPx) * $documentWidthMm;
        $displayedHeightMm = ($displayedHeightPx / $canvasHeightPx) * $documentHeightMm;

        $printedWidthInches = max(0.01, $displayedWidthMm / 25.4);
        $printedHeightInches = max(0.01, $displayedHeightMm / 25.4);

        $effectiveDpiX = $effectiveSourceWidth / $printedWidthInches;
        $effectiveDpiY = $effectiveSourceHeight / $printedHeightInches;

        $effectiveDpi = round(min($effectiveDpiX, $effectiveDpiY), 2);

        return [
            'effective_dpi' => $effectiveDpi,
            'printed_width_in' => round($printedWidthInches, 3),
            'printed_height_in' => round($printedHeightInches, 3),
        ];
    }

    /**
     * Analyze image quality against target DPI and recommend the smallest suitable scale factor.
     */
    public function analyzeQuality(
        float $effectiveDpi,
        int $targetDpi,
        int $sourceWidth,
        int $sourceHeight,
        float $printedWidthInches,
        float $printedHeightInches
    ): array {
        $requiredWidthPx = (int) ceil($printedWidthInches * $targetDpi);
        $requiredHeightPx = (int) ceil($printedHeightInches * $targetDpi);

        $maxPixels = (int) config('upscaler.max_pixels', 100000000);
        $maxWidth = (int) config('upscaler.max_width', 16000);
        $maxHeight = (int) config('upscaler.max_height', 16000);

        // Quality rating
        $qualityLevel = 'excellent';
        if ($effectiveDpi < 150) {
            $qualityLevel = 'low';
        } elseif ($effectiveDpi < $targetDpi) {
            $qualityLevel = 'acceptable';
        }

        // Scale selection logic
        if ($effectiveDpi >= $targetDpi) {
            return [
                'quality_level' => 'excellent',
                'effective_dpi' => (int) round($effectiveDpi),
                'target_dpi' => $targetDpi,
                'required_width_px' => $requiredWidthPx,
                'required_height_px' => $requiredHeightPx,
                'recommended_scale' => 1,
                'requires_upscale' => false,
                'can_reach_target' => true,
                'warning' => null,
                'message' => 'Image quality meets the target resolution.',
            ];
        }

        // Check if 2x reaches target
        $recommendedScale = 4;
        if (($effectiveDpi * 2) >= $targetDpi) {
            $recommendedScale = 2;
        }

        $potentialFinalDpi = (int) round($effectiveDpi * $recommendedScale);
        $canReachTarget = $potentialFinalDpi >= $targetDpi;

        // Check dimension limits
        $outWidth = $sourceWidth * $recommendedScale;
        $outHeight = $sourceHeight * $recommendedScale;
        $outPixels = $outWidth * $outHeight;

        $warning = null;
        if ($outWidth > $maxWidth || $outHeight > $maxHeight || $outPixels > $maxPixels) {
            $warning = "Upscaling this image ({$outWidth}x{$outHeight}) exceeds the maximum resolution limits ({$maxWidth}x{$maxHeight}).";
        } elseif (!$canReachTarget) {
            $warning = "4x upscaling will reach ~{$potentialFinalDpi} DPI, which is below the requested {$targetDpi} DPI.";
        }

        return [
            'quality_level' => $qualityLevel,
            'effective_dpi' => (int) round($effectiveDpi),
            'target_dpi' => $targetDpi,
            'required_width_px' => $requiredWidthPx,
            'required_height_px' => $requiredHeightPx,
            'recommended_scale' => $recommendedScale,
            'requires_upscale' => true,
            'can_reach_target' => $canReachTarget,
            'warning' => $warning,
            'message' => $qualityLevel === 'low'
                ? 'This image should be enhanced for high-quality printing.'
                : 'This image is acceptable, but enhancement will improve sharpness.',
        ];
    }

    /**
     * Validate a remote image URL against SSRF threats and store it securely.
     */
    public function fetchAndStoreRemoteImage(string $url, string $subfolder = 'originals'): array
    {
        $this->assertSafeRemoteUrl($url);

        $response = Http::timeout(30)
            ->withHeaders(['User-Agent' => 'PrintEcommerce-Upscaler/1.0'])
            ->get($url);

        if (!$response->successful()) {
            throw new RuntimeException("Failed to download remote image (HTTP {$response->status()}).");
        }

        $body = $response->body();
        if (strlen($body) === 0) {
            throw new RuntimeException('Downloaded image is empty.');
        }

        if (strlen($body) > 50 * 1024 * 1024) {
            throw new RuntimeException('Remote image exceeds the 50 MB size limit.');
        }

        // Verify valid image data
        $imageInfo = @getimagesizefromstring($body);
        if ($imageInfo === false) {
            throw new RuntimeException('Downloaded file is not a valid image format.');
        }

        $width = (int) $imageInfo[0];
        $height = (int) $imageInfo[1];
        $mime = $imageInfo['mime'] ?? 'image/png';

        $ext = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'png',
        };

        $checksum = hash('sha256', $body);
        $filename = Str::uuid() . '.' . $ext;
        $relativePath = "images/{$subfolder}/{$filename}";

        Storage::disk('public')->put($relativePath, $body);

        return [
            'path' => $relativePath,
            'width' => $width,
            'height' => $height,
            'mime_type' => $mime,
            'size_bytes' => strlen($body),
            'checksum' => $checksum,
            'file_name' => $filename,
        ];
    }

    /**
     * SSRF defense: enforces domain allowlist and rejects private/loopback/cloud IP addresses.
     */
    public function assertSafeRemoteUrl(string $url): void
    {
        $parsed = parse_url($url);
        if (!isset($parsed['host']) || !isset($parsed['scheme'])) {
            throw new InvalidArgumentException('Invalid image URL.');
        }

        if (!in_array(strtolower($parsed['scheme']), ['http', 'https'], true)) {
            throw new InvalidArgumentException('Only HTTP and HTTPS URLs are permitted.');
        }

        $host = strtolower($parsed['host']);

        // Check if host is in allowlist
        $allowedDomains = (array) config('upscaler.allowed_remote_domains', []);
        $isAllowed = false;
        foreach ($allowedDomains as $domain) {
            if ($host === strtolower($domain) || str_ends_with($host, '.' . strtolower($domain))) {
                $isAllowed = true;
                break;
            }
        }

        if (!$isAllowed) {
            throw new InvalidArgumentException("Host '{$host}' is not in the allowed external image domains.");
        }

        // Resolve IP and check against private / reserved ranges
        $ip = gethostbyname($host);
        if ($ip && filter_var($ip, FILTER_VALIDATE_IP)) {
            // Check private and reserved IPs (except in local development environment when host is localhost)
            if (!app()->environment('local') || ($host !== 'localhost' && $host !== '127.0.0.1')) {
                if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    throw new InvalidArgumentException('Access to private or local network IP addresses is blocked.');
                }
            }
            // Block AWS metadata IP
            if ($ip === '169.254.169.254') {
                throw new InvalidArgumentException('Access to instance metadata services is forbidden.');
            }
        }
    }
}
