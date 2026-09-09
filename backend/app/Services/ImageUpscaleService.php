<?php

namespace App\Services;

use App\Models\DesignImage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

class ImageUpscaleService
{
    public function __construct(
        protected ImageQualityService $qualityService
    ) {}

    /**
     * Upscale a DesignImage using the local Real-ESRGAN binary.
     *
     * @param DesignImage $designImage
     * @param int $scale Target scale (2 or 4)
     * @return DesignImage Updated model with upscaled_path and upscaled dimensions
     */
    public function upscale(DesignImage $designImage, int $scale = 4): DesignImage
    {
        // Enforce valid scale
        if (!in_array($scale, [2, 4], true)) {
            $scale = 4;
        }

        // Prevent repeated upscaling of an already upscaled asset
        if ($designImage->upscale_status === DesignImage::STATUS_COMPLETED && !empty($designImage->upscaled_path)) {
            if (Storage::disk('public')->exists($designImage->upscaled_path)) {
                return $designImage;
            }
        }

        // Check checksum cache: if an identical image was already upscaled with the same factor, reuse it!
        $cached = DesignImage::where('file_checksum', $designImage->file_checksum)
            ->where('upscale_status', DesignImage::STATUS_COMPLETED)
            ->where('upscale_factor', $scale)
            ->whereNotNull('upscaled_path')
            ->where('id', '!=', $designImage->id)
            ->first();

        if ($cached && Storage::disk('public')->exists($cached->upscaled_path)) {
            Log::info("Reusing cached upscaled image for checksum {$designImage->file_checksum}", [
                'cached_id' => $cached->id,
                'target_id' => $designImage->id,
            ]);

            $designImage->update([
                'upscaled_path' => $cached->upscaled_path,
                'upscaled_width' => $cached->upscaled_width,
                'upscaled_height' => $cached->upscaled_height,
                'upscale_factor' => $scale,
                'upscale_status' => DesignImage::STATUS_COMPLETED,
                'upscale_error' => null,
            ]);

            return $designImage->fresh();
        }

        $designImage->update([
            'upscale_status' => DesignImage::STATUS_PROCESSING,
            'upscale_error' => null,
        ]);

        $binaryPath = (string) config('upscaler.binary_path');
        if (!file_exists($binaryPath)) {
            $errorMsg = "Real-ESRGAN binary not found at {$binaryPath}";
            $designImage->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => $errorMsg,
            ]);
            throw new RuntimeException($errorMsg);
        }

        // Resolve absolute path to the original input file
        $originalRelativePath = $designImage->original_path;
        if (!Storage::disk('public')->exists($originalRelativePath)) {
            $errorMsg = "Original image not found in storage: {$originalRelativePath}";
            $designImage->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => $errorMsg,
            ]);
            throw new RuntimeException($errorMsg);
        }

        $absoluteInputPath = Storage::disk('public')->path($originalRelativePath);

        // Validate dimensions before upscaling
        $imageInfo = @getimagesize($absoluteInputPath);
        if ($imageInfo === false) {
            $errorMsg = 'Failed to read input image dimensions.';
            $designImage->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => $errorMsg,
            ]);
            throw new RuntimeException($errorMsg);
        }

        $inWidth = (int) $imageInfo[0];
        $inHeight = (int) $imageInfo[1];

        $maxWidth = (int) config('upscaler.max_width', 16000);
        $maxHeight = (int) config('upscaler.max_height', 16000);
        $maxPixels = (int) config('upscaler.max_pixels', 100000000);

        $outExpectedWidth = $inWidth * $scale;
        $outExpectedHeight = $inHeight * $scale;

        if ($outExpectedWidth > $maxWidth || $outExpectedHeight > $maxHeight || ($outExpectedWidth * $outExpectedHeight) > $maxPixels) {
            $errorMsg = "Requested upscale dimensions ({$outExpectedWidth}x{$outExpectedHeight}) exceed maximum allowed limits ({$maxWidth}x{$maxHeight}).";
            $designImage->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => $errorMsg,
            ]);
            throw new InvalidArgumentException($errorMsg);
        }

        $tempDir = (string) config('upscaler.temp_dir', storage_path('app/temp/upscaler'));
        if (!is_dir($tempDir)) {
            @mkdir($tempDir, 0755, true);
        }

        $tempOutputFile = rtrim($tempDir, '/\\') . DIRECTORY_SEPARATOR . 'upscale_' . Str::uuid() . '.png';
        $modelName = (string) config('upscaler.model', 'realesrgan-x4plus');
        $modelsDir = (string) config('upscaler.models_dir');

        $cmd = [
            $binaryPath,
            '-i', $absoluteInputPath,
            '-o', $tempOutputFile,
            '-s', (string) $scale,
            '-n', $modelName,
            '-m', $modelsDir,
            '-f', 'png',
        ];

        $gpuId = config('upscaler.gpu_id', 'auto');
        if ($gpuId !== 'auto') {
            $cmd[] = '-g';
            $cmd[] = (string) $gpuId;
        }

        $timeout = (int) config('upscaler.timeout', 600);
        $process = new Process($cmd);
        $process->setTimeout($timeout);

        try {
            Log::info("Starting Real-ESRGAN upscale for image {$designImage->id}", [
                'scale' => $scale,
                'model' => $modelName,
                'input_dims' => "{$inWidth}x{$inHeight}",
            ]);

            $process->run();

            if (!$process->isSuccessful() || !file_exists($tempOutputFile) || filesize($tempOutputFile) === 0) {
                $err = $process->getErrorOutput() ?: $process->getOutput();
                throw new RuntimeException("Upscaler process failed: {$err}");
            }

            // Verify output image dimensions
            $outInfo = @getimagesize($tempOutputFile);
            if ($outInfo === false) {
                throw new RuntimeException('Upscaled output is not a valid image format.');
            }

            $outWidth = (int) $outInfo[0];
            $outHeight = (int) $outInfo[1];

            // Store upscaled file permanently in storage/app/public/images/upscaled
            $upscaledFilename = Str::uuid() . '.png';
            $upscaledRelativePath = "images/upscaled/{$upscaledFilename}";

            Storage::disk('public')->put($upscaledRelativePath, fopen($tempOutputFile, 'r+'));

            // Calculate new effective DPI based on existing target
            $newEffectiveDpi = $designImage->effective_dpi
                ? round($designImage->effective_dpi * ($outWidth / max(1, $inWidth)), 2)
                : null;

            $designImage->update([
                'upscaled_path' => $upscaledRelativePath,
                'upscaled_width' => $outWidth,
                'upscaled_height' => $outHeight,
                'effective_dpi' => $newEffectiveDpi,
                'upscale_factor' => $scale,
                'upscale_status' => DesignImage::STATUS_COMPLETED,
                'upscale_error' => null,
            ]);

            Log::info("Real-ESRGAN upscale completed for image {$designImage->id}", [
                'output_dims' => "{$outWidth}x{$outHeight}",
                'path' => $upscaledRelativePath,
            ]);

            return $designImage->fresh();
        } catch (Throwable $e) {
            Log::error("Real-ESRGAN upscaling failed for image {$designImage->id}: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            $designImage->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => 'Upscaling failed: ' . $e->getMessage(),
            ]);

            throw $e;
        } finally {
            if (file_exists($tempOutputFile)) {
                @unlink($tempOutputFile);
            }
        }
    }
}
