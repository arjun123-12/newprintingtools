<?php

namespace App\Models;

use App\Enums\ArtworkStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Artwork extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'file_name',
        'file_size_bytes',
        'mime_type',
        'storage_disk',
        'storage_path',
        'public_url',
        'thumbnail_url',
        'proof_pdf_url',
        'status',
        'preflight_results',
        'customer_notes',
        'admin_notes',
    ];

    protected $casts = [
        'file_size_bytes' => 'integer',
        'status' => ArtworkStatus::class,
        'preflight_results' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
