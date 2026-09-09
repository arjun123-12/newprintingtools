<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignExport extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'session_id',
        'artwork_id',
        'status',
        'progress',
        'format',
        'quality_preset',
        'target_dpi',
        'include_normal',
        'include_enhanced',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'report',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'progress' => 'integer',
            'target_dpi' => 'integer',
            'include_normal' => 'boolean',
            'include_enhanced' => 'boolean',
            'file_size' => 'integer',
            'report' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getDownloadUrlAttribute(): ?string
    {
        if ($this->status !== self::STATUS_COMPLETED || empty($this->file_path)) {
            return null;
        }
        return url("/api/v1/designer/exports/{$this->id}/download");
    }

    public function toStatusArray(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'progress' => $this->progress,
            'format' => $this->format,
            'quality_preset' => $this->quality_preset,
            'target_dpi' => $this->target_dpi,
            'include_normal' => $this->include_normal,
            'include_enhanced' => $this->include_enhanced,
            'file_name' => $this->file_name,
            'file_size' => $this->file_size,
            'download_url' => $this->download_url,
            'report' => $this->report,
            'error_message' => $this->error_message,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
