<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArtworkPage extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'artwork_id',
        'product_side_id',
        'canvas_json',
    ];

    protected $casts = [
        'canvas_json' => 'array',
    ];

    public function artwork(): BelongsTo
    {
        return $this->belongsTo(Artwork::class);
    }

    public function productSide(): BelongsTo
    {
        return $this->belongsTo(ProductSide::class);
    }
}
