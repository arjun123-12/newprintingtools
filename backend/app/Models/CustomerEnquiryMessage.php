<?php

namespace App\Models;

use App\Services\Order\ManualOrderService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CustomerEnquiryMessage extends Model
{
    use HasFactory;

    public const SENDER_CUSTOMER = 'customer';
    public const SENDER_ADMIN = 'admin';
    public const SENDER_AI = 'ai';

    public function isCustomer(): bool
    {
        return $this->sender_type === self::SENDER_CUSTOMER;
    }

    public function isAdmin(): bool
    {
        return $this->sender_type === self::SENDER_ADMIN;
    }

    public function isAi(): bool
    {
        return $this->sender_type === self::SENDER_AI;
    }

    protected $fillable = [
        'customer_enquiry_id',
        'sender_type',
        'sender_name',
        'sender_id',
        'message',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime_type',
        'attachment_size_bytes',
        'is_read_by_admin',
        'is_read_by_customer',
        'ip_address',
    ];

    protected $casts = [
        'is_read_by_admin' => 'boolean',
        'is_read_by_customer' => 'boolean',
        'attachment_size_bytes' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'attachment_url',
        'formatted_date',
        'time_ago',
    ];

    public function enquiry(): BelongsTo
    {
        return $this->belongsTo(CustomerEnquiry::class, 'customer_enquiry_id');
    }

    public function senderUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        if (app()->environment('local') || env('APP_ENV') === 'local') {
            return Storage::disk('public')->url($this->attachment_path);
        }

        return ManualOrderService::formatLivePublicStorageUrl($this->attachment_path);
    }

    public function getFormattedDateAttribute(): string
    {
        return $this->created_at ? $this->created_at->format('d M Y, h:i A') : '';
    }

    public function getTimeAgoAttribute(): string
    {
        return $this->created_at ? $this->created_at->diffForHumans() : '';
    }
}
