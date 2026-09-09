<?php

namespace App\Jobs;

use App\Models\DesignExport;
use App\Services\DesignExportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessDesignExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 600;

    public function __construct(
        public string $exportId,
        public array $canvasPayload
    ) {}

    public function handle(DesignExportService $exportService): void
    {
        $export = DesignExport::find($this->exportId);
        if (!$export) {
            Log::warning("ProcessDesignExportJob: DesignExport {$this->exportId} not found.");
            return;
        }

        try {
            $exportService->processExport($export, $this->canvasPayload);
        } catch (Throwable $e) {
            Log::error("ProcessDesignExportJob failed for export {$this->exportId}: " . $e->getMessage());
            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        Log::error("ProcessDesignExportJob permanently failed for export {$this->exportId}: " . $exception?->getMessage());

        $export = DesignExport::find($this->exportId);
        if ($export) {
            $export->update([
                'status' => DesignExport::STATUS_FAILED,
                'error_message' => 'Export timed out or permanently failed.',
            ]);
        }
    }
}
