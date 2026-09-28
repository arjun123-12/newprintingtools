<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientBriefFile extends Model
{
    protected $fillable = [
        'client_brief_id',
        'file_type',
        'original_name',
        'file_path',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
    ];

    public function clientBrief(): BelongsTo
    {
        return $this->belongsTo(ClientBrief::class);
    }

    public function getFileUrlAttribute(): string
    {
        return url(
            '/storage/' . ltrim($this->file_path, '/')
        );
    }
}