<?php

namespace App\Jobs;

use App\Models\DesignImage;
use App\Services\ImageUpscaleService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class UpscaleImageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 2;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 660;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public string $designImageId,
        public int $scale = 4
    ) {}

    /**
     * Execute the job.
     */
    public function handle(ImageUpscaleService $upscaleService): void
    {
        $image = DesignImage::find($this->designImageId);
        if (!$image) {
            Log::warning("UpscaleImageJob: DesignImage {$this->designImageId} not found.");
            return;
        }

        // Duplicate-job protection
        if ($image->upscale_status === DesignImage::STATUS_COMPLETED && !empty($image->upscaled_path)) {
            Log::info("UpscaleImageJob: DesignImage {$image->id} is already upscaled, skipping.");
            return;
        }

        try {
            $upscaleService->upscale($image, $this->scale);
        } catch (Throwable $e) {
            Log::error("UpscaleImageJob failed for image {$this->designImageId}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(?Throwable $exception): void
    {
        Log::error("UpscaleImageJob permanently failed for image {$this->designImageId}: " . $exception?->getMessage());

        $image = DesignImage::find($this->designImageId);
        if ($image) {
            $image->update([
                'upscale_status' => DesignImage::STATUS_FAILED,
                'upscale_error' => 'Upscaling timed out or permanently failed.',
            ]);
        }
    }
}
