<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class DesignImage extends Model
{
    use HasUuids;

    public const STATUS_NOT_REQUIRED = 'not_required';
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'session_id',
        'file_name',
        'original_path',
        'preview_path',
        'upscaled_path',
        'file_checksum',
        'original_width',
        'original_height',
        'upscaled_width',
        'upscaled_height',
        'effective_dpi',
        'target_dpi',
        'upscale_factor',
        'upscale_status',
        'upscale_error',
        'mime_type',
        'size_bytes',
        'source_provider',
        'source_asset_id',
    ];

    protected function casts(): array
    {
        return [
            'original_width' => 'integer',
            'original_height' => 'integer',
            'upscaled_width' => 'integer',
            'upscaled_height' => 'integer',
            'effective_dpi' => 'float',
            'target_dpi' => 'integer',
            'upscale_factor' => 'integer',
            'size_bytes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getOriginalUrlAttribute(): string
    {
        if (empty($this->original_path)) {
            return '';
        }
        return url('/api/v1/storage/' . ltrim($this->original_path, '/'));
    }

    public function getPreviewUrlAttribute(): string
    {
        if (empty($this->preview_path)) {
            return $this->original_url;
        }
        return url('/api/v1/storage/' . ltrim($this->preview_path, '/'));
    }

    public function getUpscaledUrlAttribute(): ?string
    {
        if (empty($this->upscaled_path)) {
            return null;
        }
        return url('/api/v1/storage/' . ltrim($this->upscaled_path, '/'));
    }

    /**
     * Return the tracking payload required by the specification.
     */
    public function toTrackingArray(): array
    {
        return [
            'id' => $this->id,
            'original_url' => $this->original_url,
            'preview_url' => $this->preview_url,
            'upscaled_url' => $this->upscaled_url,
            'original_width' => $this->original_width,
            'original_height' => $this->original_height,
            'upscaled_width' => $this->upscaled_width ?? $this->original_width,
            'upscaled_height' => $this->upscaled_height ?? $this->original_height,
            'effective_dpi' => (float) ($this->effective_dpi ?? 0),
            'target_dpi' => (int) ($this->target_dpi ?? 300),
            'upscale_factor' => (int) ($this->upscale_factor ?? 1),
            'upscale_status' => $this->upscale_status,
            'upscale_error' => $this->upscale_error,
        ];
    }
}
