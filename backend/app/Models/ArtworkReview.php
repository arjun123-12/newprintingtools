<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArtworkReview extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'artwork_id',
        'version_number',
        'reviewer_id',
        'action',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'metadata' => 'array',
    ];

    public function artwork(): BelongsTo
    {
        return $this->belongsTo(Artwork::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
