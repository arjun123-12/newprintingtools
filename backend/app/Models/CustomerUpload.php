<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class CustomerUpload extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'session_id',
        'file_name',
        'file_path',
        'mime_type',
        'size_bytes',
        'width',
        'height',
        'processing_type',
        'original_url',
        'source_upload_id',
        'source_provider',
        'source_provider_asset_id',
    ];
}
