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
        'access_token',
        'session_id',
        'user_id',
        'channel',
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
        'needs_human_followup',
        'is_ai_enabled',
        'ai_summary',
        'last_message_at',
        'admin_notes',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'specifications' => 'array',
        'quantity' => 'integer',
        'attachment_size_bytes' => 'integer',
        'needs_human_followup' => 'boolean',
        'is_ai_enabled' => 'boolean',
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'attachment_url',
        'conversation_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (CustomerEnquiry $enquiry) {
            if (empty($enquiry->access_token)) {
                $enquiry->access_token = static::generateAccessToken();
            }
        });
    }

    /**
     * Relationship: Authenticated customer user who initiated the enquiry, if any.
     */
    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relationship: Chronological chat messages for this enquiry.
     */
    public function messages(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CustomerEnquiryMessage::class, 'customer_enquiry_id')->orderBy('created_at', 'asc');
    }

    /**
     * Get the public URL for the uploaded attachment if present.
     */
    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        if (app()->environment('local') || env('APP_ENV') === 'local') {
            return Storage::disk('public')->url($this->attachment_path);
        }

        return \App\Services\Order\ManualOrderService::formatLivePublicStorageUrl($this->attachment_path);
    }

    /**
     * Get the authoritative frontend conversation link for this enquiry.
     */
    public function getConversationUrlAttribute(): string
    {
        if (app()->environment('local') || env('APP_ENV') === 'local') {
            $frontend = env('FRONTEND_STORE_URL', 'http://localhost:3000');
            return rtrim($frontend, '/') . '/enquiries/conversation/' . $this->access_token;
        }

        $frontend = \App\Services\Order\ManualOrderService::getLiveFrontendUrl();
        return rtrim($frontend, '/') . '/enquiries/conversation/' . $this->access_token;
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

    /**
     * Generate a 64-character unguessable secure token for customer access.
     */
    public static function generateAccessToken(): string
    {
        return bin2hex(random_bytes(32));
    }
}
