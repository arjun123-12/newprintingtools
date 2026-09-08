<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignTemplatePage extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'design_template_id',
        'product_side_id',
        'canvas_json',
    ];

    protected $casts = [
        'canvas_json' => 'array',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(DesignTemplate::class, 'design_template_id');
    }

    public function productSide(): BelongsTo
    {
        return $this->belongsTo(ProductSide::class);
    }
}
