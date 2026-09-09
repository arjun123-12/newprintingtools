<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Real-ESRGAN Local Image Upscaler Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for local Real-ESRGAN binary execution without third-party APIs.
    |
    */

    'enabled' => env('IMAGE_UPSCALER_ENABLED', true),

    'binary_path' => env(
        'REALESRGAN_BINARY_PATH',
        base_path('../tools/realesrgan/realesrgan-ncnn-vulkan.exe')
    ),

    'model' => env('REALESRGAN_MODEL', 'realesrgan-x4plus'),

    'models_dir' => env(
        'REALESRGAN_MODELS_DIR',
        base_path('../tools/realesrgan/models')
    ),

    'max_scale' => (int) env('IMAGE_UPSCALER_MAX_SCALE', 4),

    'timeout' => (int) env('IMAGE_UPSCALER_TIMEOUT', 600),

    'max_width' => (int) env('IMAGE_UPSCALER_MAX_WIDTH', 16000),

    'max_height' => (int) env('IMAGE_UPSCALER_MAX_HEIGHT', 16000),

    'max_pixels' => (int) env('IMAGE_UPSCALER_MAX_PIXELS', 100000000),

    'gpu_id' => env('REALESRGAN_GPU_ID', 'auto'),

    'temp_dir' => env(
        'IMAGE_UPSCALER_TEMP_DIR',
        storage_path('app/temp/upscaler')
    ),

    'storage_disk' => env('IMAGE_UPSCALER_DISK', 'public'),

    'allowed_remote_domains' => [
        'api.freepik.com',
        'img.freepik.com',
        'images.freepik.com',
        'images.pexels.com',
        'localhost',
        '127.0.0.1',
    ],
];
