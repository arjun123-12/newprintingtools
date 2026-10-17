<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArtworkVersion extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'artwork_id',
        'version_number',
        'file_name',
        'file_size_bytes',
        'mime_type',
        'storage_disk',
        'storage_path',
        'thumbnail_url',
        'proof_pdf_url',
        'proof_files',
        'width_px',
        'height_px',
        'dpi',
        'color_profile',
        'preflight_results',
        'is_approved',
        'uploaded_by',
        'change_summary',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'file_size_bytes' => 'integer',
        'width_px' => 'integer',
        'height_px' => 'integer',
        'dpi' => 'integer',
        'proof_files' => 'array',
        'preflight_results' => 'array',
        'is_approved' => 'boolean',
    ];

    public function artwork(): BelongsTo
    {
        return $this->belongsTo(Artwork::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
