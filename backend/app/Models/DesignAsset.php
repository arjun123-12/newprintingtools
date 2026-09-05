<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class DesignAsset extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'asset_type',
        'file_path',
        'file_url',
        'thumbnail_path',
        'thumbnail_url',
        'fabric_json',
        'metadata',
        'provider',
        'provider_asset_id',
        'license_name',
        'attribution',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'fabric_json' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(DesignAssetCategory::class, 'category_id');
    }

    public function getAssetUrlAttribute()
    {
        if ($this->file_url) {
            return $this->file_url;
        }

        if ($this->file_path) {
            return Storage::disk('public')->url($this->file_path);
        }

        return null;
    }

    public function getAssetThumbnailUrlAttribute()
    {
        if ($this->thumbnail_url) {
            return $this->thumbnail_url;
        }

        if ($this->thumbnail_path) {
            return Storage::disk('public')->url($this->thumbnail_path);
        }

        return null;
    }
}
