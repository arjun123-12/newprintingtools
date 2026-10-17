<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderActivity extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'order_id',
        'event_type',
        'description',
        'actor_type',
        'actor_id',
        'actor_name',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * Record an audit activity event for an order.
     */
    public static function record(
        string $orderId,
        string $eventType,
        string $description,
        string $actorType = 'system',
        ?User $actor = null,
        ?array $metadata = null
    ): self {
        return self::create([
            'order_id' => $orderId,
            'event_type' => $eventType,
            'description' => $description,
            'actor_type' => $actorType,
            'actor_id' => $actor?->id,
            'actor_name' => $actor ? ($actor->name ?: $actor->email) : ($actorType === 'customer' ? 'Customer' : ucfirst($actorType)),
            'metadata' => $metadata,
        ]);
    }
}
