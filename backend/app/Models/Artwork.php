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
        'session_id',
        'product_id',
        'template_id',
        'design_template_id',
        'name',
        'source_type',
        'design_status',
        'canvas_json',
        'document_settings',
        'width_px',
        'height_px',
        'dpi',
        'unit',
        'bleed',
        'safe_area',
        'background_color',

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
        'canvas_json' => 'array',
        'document_settings' => 'array',
        'preflight_results' => 'array',

        'width_px' => 'integer',
        'height_px' => 'integer',
        'dpi' => 'integer',
        'bleed' => 'float',
        'safe_area' => 'float',
        'file_size_bytes' => 'integer',

        'status' => ArtworkStatus::class,
    ];

    protected static function booted(): void
    {
        static::saving(function (Artwork $artwork) {
            // Keep template_id and design_template_id in sync
            if (!empty($artwork->template_id) && empty($artwork->design_template_id)) {
                $artwork->design_template_id = $artwork->template_id;
            } elseif (!empty($artwork->design_template_id) && empty($artwork->template_id)) {
                $artwork->template_id = $artwork->design_template_id;
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(DesignTemplate::class, 'template_id');
    }

    public function designTemplate(): BelongsTo
    {
        return $this->belongsTo(DesignTemplate::class, 'design_template_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}