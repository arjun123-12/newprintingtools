<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientBriefMessage extends Model
{
    protected $fillable = ['client_brief_id', 'author', 'message'];

    public function clientBrief(): BelongsTo
    {
        return $this->belongsTo(ClientBrief::class);
    }
}
