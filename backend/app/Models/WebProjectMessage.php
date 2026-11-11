<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebProjectMessage extends Model
{
    protected $fillable = ['project_id', 'author_id', 'author_type', 'message'];
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'author_id'); }
}
