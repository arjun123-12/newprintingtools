<?php

namespace App\Services\Artwork;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ArtworkStorageService
{
    /**
     * Generate a pre-signed upload URL for direct Cloudflare R2 / S3 upload
     */
    public function generatePresignedUploadUrl(string $fileName, string $mimeType): array
    {
        $disk = config('filesystems.default', 'r2');
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        $uniqueKey = 'artwork/' . date('Y/m/') . Str::uuid() . '.' . $extension;

        return [
            'key' => $uniqueKey,
            'disk' => $disk,
            'upload_url' => url('/api/v1/artwork/mock-upload'), // In production, generated via S3 client createPresignedRequest
            'headers' => [
                'Content-Type' => $mimeType,
            ],
            'public_url' => config("filesystems.disks.{$disk}.url") . '/' . $uniqueKey,
        ];
    }
}
