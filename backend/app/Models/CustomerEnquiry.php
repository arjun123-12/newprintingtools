<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class CustomerEnquiry extends Model
{
    use HasFactory;

    public const STATUS_NEW = 'new';
    public const STATUS_CONTACTED = 'contacted';
    public const STATUS_QUOTED = 'quoted';
    public const STATUS_CONVERTED = 'converted';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_CONTACTED,
        self::STATUS_QUOTED,
        self::STATUS_CONVERTED,
        self::STATUS_CLOSED,
    ];

    protected $fillable = [
        'reference',
        'name',
        'email',
        'phone',
        'product_id',
        'product_name',
        'quantity',
        'specifications',
        'delivery_location',
        'additional_requirements',
        'source_url',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime_type',
        'attachment_size_bytes',
        'status',
        'admin_notes',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'specifications' => 'array',
        'quantity' => 'integer',
        'attachment_size_bytes' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'attachment_url',
    ];

    /**
     * Get the public URL for the uploaded attachment if present.
     */
    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        return Storage::disk('public')->url($this->attachment_path);
    }

    /**
     * Generate a unique human-friendly enquiry reference code.
     */
    public static function generateReference(): string
    {
        $prefix = 'ENQ-' . date('Y');
        $random = strtoupper(bin2hex(random_bytes(3))); // 6 hex chars
        return "{$prefix}-{$random}";
    }
}
