<?php

namespace App\Enums;

enum OrderStatus: string
{
    case DRAFT = 'draft';
    case PENDING_PAYMENT = 'pending_payment';
    case PROCESSING = 'processing';
    case ARTWORK_REQUIRED = 'artwork_required';
    case ARTWORK_REVIEW = 'artwork_review';
    case CHANGES_REQUESTED = 'changes_requested';
    case APPROVED = 'approved';
    case IN_PRODUCTION = 'in_production';
    case PRODUCTION_STARTED = 'production_started';
    case CUTTING_IN_PROGRESS = 'cutting_in_progress';
    case PRODUCTION_COMPLETED = 'production_completed';
    case READY_FOR_SHIPPING = 'ready_for_shipping';
    case DISPATCHED = 'dispatched';
    case HANDED_OVER_TO_COURIER = 'handed_over_to_courier';
    case DELIVERED = 'delivered';
    case CANCELLED = 'cancelled';
    case REFUNDED = 'refunded';

    public const WORKFLOW_SEQUENCE = [
        'production_started' => 'Production started',
        'cutting_in_progress' => 'Cutting in progress',
        'production_completed' => 'Production completed',
        'ready_for_shipping' => 'Ready for shipping',
        'handed_over_to_courier' => 'Handed over to courier',
        'delivered' => 'Delivered',
    ];

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Draft',
            self::PENDING_PAYMENT => 'Pending Payment',
            self::PROCESSING => 'Processing',
            self::ARTWORK_REQUIRED => 'Artwork Required',
            self::ARTWORK_REVIEW => 'Artwork Review',
            self::CHANGES_REQUESTED => 'Changes Requested',
            self::APPROVED => 'Approved',
            self::IN_PRODUCTION, self::PRODUCTION_STARTED => 'Production started',
            self::CUTTING_IN_PROGRESS => 'Cutting in progress',
            self::PRODUCTION_COMPLETED => 'Production completed',
            self::READY_FOR_SHIPPING => 'Ready for shipping',
            self::DISPATCHED, self::HANDED_OVER_TO_COURIER => 'Handed over to courier',
            self::DELIVERED => 'Delivered',
            self::CANCELLED => 'Cancelled',
            self::REFUNDED => 'Refunded',
        };
    }
}
