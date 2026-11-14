<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientBriefMessage extends Model
{
    protected $fillable = ['client_brief_id', 'author', 'message', 'attachment_path', 'attachment_name', 'attachment_mime_type'];

    protected $appends = ['attachment_url'];

    public function getAttachmentUrlAttribute(): ?string
    {
        return $this->attachment_path ? url('/storage/' . ltrim($this->attachment_path, '/')) : null;
    }

    public function clientBrief(): BelongsTo
    {
        return $this->belongsTo(ClientBrief::class);
    }
}
