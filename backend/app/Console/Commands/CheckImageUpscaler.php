<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class CheckImageUpscaler extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'image-upscaler:check';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verify local Real-ESRGAN executable, models, storage directories, and run test upscale';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('=== Real-ESRGAN Local Upscaler Health Check ===');

        $enabled = (bool) config('upscaler.enabled', true);
        if (!$enabled) {
            $this->warn('[WARN] Image upscaler is currently disabled in configuration (IMAGE_UPSCALER_ENABLED=false).');
        }

        $allPassed = true;

        // 1. Verify executable exists
        $binaryPath = (string) config('upscaler.binary_path');
        $this->line("1. Checking binary path: {$binaryPath}");
        if (empty($binaryPath) || !file_exists($binaryPath)) {
            $this->error("   [FAIL] Binary file not found at: {$binaryPath}");
            $allPassed = false;
        } else {
            $this->info('   [PASS] Executable file exists.');
        }

        // 2. Verify executable can run
        if (file_exists($binaryPath)) {
            $this->line('2. Testing binary execution...');
            $process = new Process([$binaryPath, '-h']);
            $process->setTimeout(15);
            $process->run();

            // Real-ESRGAN prints help output and may return exit code 1 or 0 for -h
            $output = $process->getOutput() . $process->getErrorOutput();
            if (str_contains($output, 'Usage: realesrgan-ncnn-vulkan')) {
                $this->info('   [PASS] Real-ESRGAN binary executed successfully.');
            } else {
                $this->error('   [FAIL] Unable to execute binary: ' . ($process->getErrorOutput() ?: $process->getOutput()));
                $allPassed = false;
            }
        }

        // 3. Verify models exist
        $model = (string) config('upscaler.model', 'realesrgan-x4plus');
        $modelsDir = (string) config('upscaler.models_dir');
        if (empty($modelsDir) && file_exists($binaryPath)) {
            $modelsDir = dirname($binaryPath) . DIRECTORY_SEPARATOR . 'models';
        }

        $this->line("3. Checking model: {$model} in {$modelsDir}");
        $binFile = rtrim($modelsDir, '/\\') . DIRECTORY_SEPARATOR . "{$model}.bin";
        $paramFile = rtrim($modelsDir, '/\\') . DIRECTORY_SEPARATOR . "{$model}.param";

        if (!file_exists($binFile) || !file_exists($paramFile)) {
            $this->error("   [FAIL] Model files missing ({$model}.bin or {$model}.param not found).");
            $allPassed = false;
        } else {
            $this->info("   [PASS] Model files for '{$model}' exist.");
        }

        // 4. Verify writable storage directories
        $dirsToCheck = [
            'Temp Directory' => (string) config('upscaler.temp_dir', storage_path('app/temp/upscaler')),
            'Originals' => storage_path('app/public/images/originals'),
            'Previews' => storage_path('app/public/images/previews'),
            'Upscaled' => storage_path('app/public/images/upscaled'),
            'Exports' => storage_path('app/public/exports'),
        ];

        $this->line('4. Checking storage directories...');
        foreach ($dirsToCheck as $label => $dir) {
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            if (!is_writable($dir)) {
                $this->error("   [FAIL] {$label} ({$dir}) is not writable.");
                $allPassed = false;
            } else {
                $this->line("   [PASS] {$label} is writable: {$dir}");
            }
        }

        // 5. Test real image processing with 16x16 test image
        if ($allPassed) {
            $this->line('5. Running test upscale (16x16 -> 32x32)...');
            $tempDir = (string) config('upscaler.temp_dir', storage_path('app/temp/upscaler'));
            $testInput = rtrim($tempDir, '/\\') . DIRECTORY_SEPARATOR . 'test_in_' . uniqid() . '.png';
            $testOutput = rtrim($tempDir, '/\\') . DIRECTORY_SEPARATOR . 'test_out_' . uniqid() . '.png';

            // Create 16x16 PNG
            $im = imagecreatetruecolor(16, 16);
            $bg = imagecolorallocate($im, 70, 130, 180);
            imagefill($im, 0, 0, $bg);
            imagepng($im, $testInput);
            imagedestroy($im);

            try {
                $cmd = [
                    $binaryPath,
                    '-i', $testInput,
                    '-o', $testOutput,
                    '-s', '2',
                    '-n', $model,
                    '-m', $modelsDir,
                ];

                $gpuId = config('upscaler.gpu_id', 'auto');
                if ($gpuId !== 'auto') {
                    $cmd[] = '-g';
                    $cmd[] = (string) $gpuId;
                }

                $process = new Process($cmd);
                $process->setTimeout((int) config('upscaler.timeout', 120));
                $process->run();

                if (!$process->isSuccessful() || !file_exists($testOutput)) {
                    $this->error('   [FAIL] Test upscale failed: ' . $process->getErrorOutput());
                    $allPassed = false;
                } else {
                    $info = @getimagesize($testOutput);
                    $width = $info[0] ?? 0;
                    $height = $info[1] ?? 0;
                    if ($width === 32 && $height === 32) {
                        $this->info("   [PASS] Test image upscaled successfully to {$width}x{$height}px.");
                    } else {
                        $this->warn("   [WARN] Test image generated with size {$width}x{$height}px.");
                    }
                }
            } finally {
                @unlink($testInput);
                @unlink($testOutput);
            }
        }

        $this->newLine();
        if ($allPassed) {
            $this->info('✓ All Real-ESRGAN health checks passed successfully!');
            return Command::SUCCESS;
        }

        $this->error('✗ Real-ESRGAN health check failed.');
        return Command::FAILURE;
    }
}
