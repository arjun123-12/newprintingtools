<?php

namespace App\Services\Artwork;

use App\Models\Artwork;
use Illuminate\Support\Facades\Storage;

class ArtworkValidationService
{
    /**
     * Supported commercial print MIME types.
     */
    public const SUPPORTED_MIMES = [
        'application/pdf',
        'image/tiff',
        'image/x-tiff',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'image/vnd.adobe.photoshop',
        'application/postscript',
        'application/illustrator',
        'application/octet-stream',
    ];

    /**
     * Inspect file metadata, check resolution, verify color profile, and check bleed specifications.
     * Backwards-compatible signature for existing calls.
     */
    public function preflightCheck(string $filePath, array $expectedDimensionsMm): array
    {
        $dummyArtwork = new Artwork([
            'storage_path' => $filePath,
            'source_type' => 'upload',
        ]);

        return $this->inspectArtwork($dummyArtwork, $expectedDimensionsMm);
    }

    /**
     * Perform comprehensive preflight check on an Artwork record.
     * Never claims a check passed when it could not be verified.
     */
    public function inspectArtwork(Artwork $artwork, ?array $overrideDimensions = null): array
    {
        $flags = [];
        $warnings = [];
        $errors = [];
        $checks = [];

        $filePresent = false;
        $fileSize = $artwork->file_size_bytes;
        $mimeType = $artwork->mime_type;
        $widthPx = $artwork->width_px;
        $heightPx = $artwork->height_px;
        $colorProfile = 'Unreadable';
        $colorProfileVerified = false;
        $colorProfileStatus = 'unreadable'; // verified, warning, unreadable
        $estimatedDpi = null;
        $dpiStatus = 'unverified'; // passed, warning, failed, unverified

        // -------------------------------------------------------------
        // 1. FILE INTEGRITY & ACCESSIBILITY CHECK
        // -------------------------------------------------------------
        $localFilePath = null;
        $storageDisk = $artwork->storage_disk ?: 'public';
        $storagePath = $artwork->storage_path;

        if ($artwork->source_type === 'designer') {
            // Online designer canvas project
            $filePresent = !empty($artwork->canvas_json);
            if (!$filePresent) {
                $errors[] = 'Designer canvas JSON data is empty or missing.';
                $flags[] = 'MISSING_FILE';
                $checks[] = [
                    'name' => 'File Integrity',
                    'status' => 'failed',
                    'message' => 'Design canvas data is missing.',
                ];
            } else {
                $filePresent = true;
                $fileSize = strlen(json_encode($artwork->canvas_json));
                $mimeType = 'application/json';
                $checks[] = [
                    'name' => 'File Integrity',
                    'status' => 'passed',
                    'message' => 'Online designer canvas data loaded successfully.',
                ];
            }
        } else {
            // Uploaded file
            if (!empty($storagePath)) {
                if (Storage::disk($storageDisk)->exists($storagePath)) {
                    $filePresent = true;
                    $fileSize = Storage::disk($storageDisk)->size($storagePath);
                    $localFilePath = Storage::disk($storageDisk)->path($storagePath);
                    $mimeType = $mimeType ?: Storage::disk($storageDisk)->mimeType($storagePath);
                } elseif (file_exists($storagePath)) {
                    $filePresent = true;
                    $localFilePath = $storagePath;
                    $fileSize = filesize($storagePath);
                } elseif (file_exists(public_path($storagePath))) {
                    $filePresent = true;
                    $localFilePath = public_path($storagePath);
                    $fileSize = filesize($localFilePath);
                }
            }

            if (!$filePresent) {
                $errors[] = 'Submitted artwork file is missing or inaccessible on storage.';
                $flags[] = 'MISSING_FILE';
                $checks[] = [
                    'name' => 'File Integrity',
                    'status' => 'failed',
                    'message' => 'Artwork file is missing from storage (' . ($storagePath ?: 'No path provided') . ').',
                ];
            } else {
                $checks[] = [
                    'name' => 'File Integrity',
                    'status' => 'passed',
                    'message' => 'File is accessible (' . round($fileSize / 1024 / 1024, 2) . ' MB).',
                ];
            }
        }

        // -------------------------------------------------------------
        // 2. FILE FORMAT & EXTENSION VALIDATION
        // -------------------------------------------------------------
        if ($filePresent && $artwork->source_type !== 'designer') {
            $ext = strtolower(pathinfo($storagePath ?: $artwork->file_name, PATHINFO_EXTENSION));
            $isSupportedMime = in_array(strtolower((string) $mimeType), self::SUPPORTED_MIMES, true)
                || in_array($ext, ['pdf', 'tif', 'tiff', 'jpg', 'jpeg', 'png', 'psd', 'ai', 'eps', 'webp', 'svg'], true);

            if (!$isSupportedMime) {
                $errors[] = "File format '{$ext}' ({$mimeType}) is not supported for production print.";
                $flags[] = 'UNSUPPORTED_FORMAT';
                $checks[] = [
                    'name' => 'Format Compatibility',
                    'status' => 'failed',
                    'message' => "Unsupported file format '{$ext}'. PDF, TIFF, EPS, AI, PSD, JPEG or PNG required.",
                ];
            } else {
                $checks[] = [
                    'name' => 'Format Compatibility',
                    'status' => 'passed',
                    'message' => "Supported print format: " . strtoupper($ext ?: 'file') . " ({$mimeType}).",
                ];
            }
        }

        // -------------------------------------------------------------
        // 3. DIMENSIONS & RESOLUTION / DPI AT PRINT SIZE
        // -------------------------------------------------------------
        // Extract real image pixel dimensions if local file is inspectable
        if ($filePresent && $localFilePath && file_exists($localFilePath)) {
            $imageInfo = @getimagesize($localFilePath);
            if (is_array($imageInfo)) {
                $widthPx = $imageInfo[0] ?? $widthPx;
                $heightPx = $imageInfo[1] ?? $heightPx;

                // Color channels detection
                $channels = $imageInfo['channels'] ?? null;
                if ($channels === 4) {
                    $colorProfile = 'CMYK';
                    $colorProfileVerified = true;
                    $colorProfileStatus = 'verified';
                } elseif ($channels === 3) {
                    $colorProfile = 'RGB';
                    $colorProfileVerified = true;
                    $colorProfileStatus = 'warning';
                } elseif ($channels === 1) {
                    $colorProfile = 'Grayscale';
                    $colorProfileVerified = true;
                    $colorProfileStatus = 'verified';
                }
            }
        }

        // Resolve target print size in millimeters
        $targetWidthMm = $overrideDimensions['width_mm']
            ?? $overrideDimensions['width']
            ?? $artwork->document_settings['width_mm']
            ?? $artwork->product?->width_mm
            ?? null;

        $targetHeightMm = $overrideDimensions['height_mm']
            ?? $overrideDimensions['height']
            ?? $artwork->document_settings['height_mm']
            ?? $artwork->product?->height_mm
            ?? null;

        // Try extracting dimensions from linked order item options snapshot if not yet found
        if (!$targetWidthMm && $artwork->relationLoaded('orderItems') && $artwork->orderItems->isNotEmpty()) {
            $firstItem = $artwork->orderItems->first();
            $options = $firstItem->options_snapshot ?? [];
            if (!empty($options['size_mm'])) {
                $targetWidthMm = $options['size_mm']['width'] ?? null;
                $targetHeightMm = $options['size_mm']['height'] ?? null;
            } elseif (!empty($options['dimensions'])) {
                // e.g. "90x54"
                if (preg_match('/^(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/', (string) $options['dimensions'], $m)) {
                    $targetWidthMm = (float) $m[1];
                    $targetHeightMm = (float) $m[2];
                }
            }
        }

        // Calculate DPI at print size
        if ($widthPx && $targetWidthMm && $targetWidthMm > 0) {
            // 1 inch = 25.4 mm => DPI = (width_px * 25.4) / width_mm
            $estimatedDpi = (int) round(($widthPx * 25.4) / $targetWidthMm);

            if ($estimatedDpi >= 300) {
                $dpiStatus = 'passed';
                $checks[] = [
                    'name' => 'Resolution & DPI',
                    'status' => 'passed',
                    'message' => "Estimated {$estimatedDpi} DPI at {$targetWidthMm}x{$targetHeightMm}mm (300+ DPI optimal for offset/digital print).",
                ];
            } elseif ($estimatedDpi >= 150) {
                $dpiStatus = 'warning';
                $flags[] = 'LOW_RESOLUTION';
                $warnings[] = "Low resolution warning: Estimated {$estimatedDpi} DPI at selected print size {$targetWidthMm}x{$targetHeightMm}mm. Minimum recommended is 300 DPI.";
                $checks[] = [
                    'name' => 'Resolution & DPI',
                    'status' => 'warning',
                    'message' => "Estimated {$estimatedDpi} DPI at {$targetWidthMm}x{$targetHeightMm}mm (Below 300 DPI recommended; visual softness may occur).",
                ];
            } else {
                $dpiStatus = 'failed';
                $flags[] = 'CRITICAL_LOW_RESOLUTION';
                $errors[] = "Critical low resolution: Estimated {$estimatedDpi} DPI at {$targetWidthMm}x{$targetHeightMm}mm is below the 150 DPI production threshold.";
                $checks[] = [
                    'name' => 'Resolution & DPI',
                    'status' => 'failed',
                    'message' => "Critical {$estimatedDpi} DPI at {$targetWidthMm}x{$targetHeightMm}mm (Unacceptable pixelation will occur on press).",
                ];
            }
        } elseif ($artwork->dpi) {
            $estimatedDpi = $artwork->dpi;
            if ($estimatedDpi >= 300) {
                $dpiStatus = 'passed';
                $checks[] = [
                    'name' => 'Resolution & DPI',
                    'status' => 'passed',
                    'message' => "Artwork declares {$estimatedDpi} DPI. Target physical print size not specified.",
                ];
            } else {
                $dpiStatus = 'warning';
                $flags[] = 'LOW_RESOLUTION';
                $warnings[] = "Artwork DPI is {$estimatedDpi} (Below standard 300 DPI).";
                $checks[] = [
                    'name' => 'Resolution & DPI',
                    'status' => 'warning',
                    'message' => "Artwork declares {$estimatedDpi} DPI (Below 300 DPI standard).",
                ];
            }
        } else {
            // Cannot verify without print size or embedded DPI
            $dpiStatus = 'unverified';
            $flags[] = 'UNVERIFIED_RESOLUTION';
            $warnings[] = 'Resolution at print size could not be verified (Target print dimensions unknown).';
            $checks[] = [
                'name' => 'Resolution & DPI',
                'status' => 'unverified',
                'message' => 'Resolution could not be verified. Target print dimensions not specified.',
            ];
        }

        // -------------------------------------------------------------
        // 4. COLOR PROFILE VERIFICATION
        // -------------------------------------------------------------
        if ($colorProfileVerified) {
            if ($colorProfile === 'CMYK' || $colorProfile === 'Grayscale') {
                $checks[] = [
                    'name' => 'Color Profile',
                    'status' => 'passed',
                    'message' => "{$colorProfile} color space detected (Commercial press compatible).",
                ];
            } elseif ($colorProfile === 'RGB') {
                $flags[] = 'RGB_COLORSPACE';
                $warnings[] = 'Artwork is in RGB color space. Automatic conversion to CMYK during plate generation may cause noticeable color shift.';
                $checks[] = [
                    'name' => 'Color Profile',
                    'status' => 'warning',
                    'message' => 'RGB color space detected. Convert to CMYK for accurate color reproduction.',
                ];
            }
        } else {
            // Check if vector PDF / SVG / unrecognized
            $colorProfile = 'Unreadable / Unverified';
            $colorProfileStatus = 'unreadable';
            $flags[] = 'UNREADABLE_COLOR_PROFILE';
            $warnings[] = 'Color profile data is unreadable from file headers. Do not assume CMYK compliance without RIP inspection.';
            $checks[] = [
                'name' => 'Color Profile',
                'status' => 'unverified',
                'message' => 'Color profile data is unreadable or vector format. Manual prepress check required.',
            ];
        }

        // -------------------------------------------------------------
        // 5. BLEED & SAFETY MARGIN CHECK
        // -------------------------------------------------------------
        $bleedMm = $artwork->bleed ?? $artwork->document_settings['bleed'] ?? 0.0;
        $hasBleed = ((float) $bleedMm) >= 2.0;

        if ($hasBleed) {
            $checks[] = [
                'name' => 'Bleed & Cutting Margin',
                'status' => 'passed',
                'message' => "Bleed detected: {$bleedMm}mm (Satisfies 2.0mm+ commercial guillotine trimming standard).",
            ];
        } elseif (((float) $bleedMm) > 0) {
            $flags[] = 'INSUFFICIENT_BLEED';
            $warnings[] = "Bleed is {$bleedMm}mm, which is below the 2.0mm industry standard.";
            $checks[] = [
                'name' => 'Bleed & Cutting Margin',
                'status' => 'warning',
                'message' => "Bleed is only {$bleedMm}mm (2.0mm - 3.0mm required for safe trimming).",
            ];
        } else {
            $flags[] = 'NO_BLEED';
            $warnings[] = 'No bleed margin detected (0mm). Risk of white slivers along trimmed edges.';
            $checks[] = [
                'name' => 'Bleed & Cutting Margin',
                'status' => 'warning',
                'message' => 'No bleed margin detected. 2.0mm to 3.0mm bleed required.',
            ];
        }

        // -------------------------------------------------------------
        // 6. OVERALL VERDICT DETERMINATION
        // -------------------------------------------------------------
        $overallStatus = 'preflight_passed';
        $passed = true;

        if (!empty($errors)) {
            $overallStatus = 'preflight_failed';
            $passed = false;
        } elseif (!empty($warnings) || $dpiStatus === 'unverified' || !$colorProfileVerified) {
            $overallStatus = 'preflight_warning';
            $passed = true; // technically processable with caution
        }

        return [
            'passed' => $passed,
            'status' => $overallStatus, // preflight_passed, preflight_warning, preflight_failed
            'flags' => array_values(array_unique($flags)),
            'warnings' => $warnings,
            'errors' => $errors,
            'checks' => $checks,
            'metrics' => [
                'file_present' => $filePresent,
                'file_size_bytes' => $fileSize,
                'file_size_formatted' => $fileSize ? (round($fileSize / 1024 / 1024, 2) . ' MB') : 'Unknown',
                'mime_type' => $mimeType,
                'width_px' => $widthPx,
                'height_px' => $heightPx,
                'target_width_mm' => $targetWidthMm,
                'target_height_mm' => $targetHeightMm,
                'estimated_dpi' => $estimatedDpi,
                'dpi_status' => $dpiStatus,
                'color_profile' => $colorProfile,
                'color_profile_verified' => $colorProfileVerified,
                'color_profile_status' => $colorProfileStatus,
                'bleed_detected_mm' => (float) $bleedMm,
                'has_bleed' => $hasBleed,
            ],
            'inspected_at' => now()->toIso8601String(),
        ];
    }
}
