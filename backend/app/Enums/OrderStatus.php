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
    case PRINTING = 'printing';
    case CUTTING_AND_FINISHING = 'cutting_and_finishing';
    case QUALITY_CHECK_AND_PACKAGING = 'quality_check_and_packaging';
    case READY_FOR_PICKUP = 'ready_for_pickup';
    case IN_PRODUCTION = 'in_production';
    case PRODUCTION_STARTED = 'production_started';
    case CUTTING_IN_PROGRESS = 'cutting_in_progress';
    case PRODUCTION_COMPLETED = 'production_completed';
    case READY_FOR_SHIPPING = 'ready_for_shipping';
    case DISPATCHED = 'dispatched';
    case HANDED_OVER_TO_COURIER = 'handed_over_to_courier';
    case DELIVERED = 'delivered';
    case COLLECTED = 'collected';
    case CANCELLED = 'cancelled';
    case REFUNDED = 'refunded';

    public const WORKFLOW_SEQUENCE = [
        'printing' => 'Printing',
        'cutting_and_finishing' => 'Cutting & Finishing',
        'quality_check_and_packaging' => 'Quality Check & Packaging',
        'ready_for_pickup' => 'Ready for Pickup',
        'handed_over_to_courier' => 'Handed over to courier',
        'delivered' => 'Delivered',
        'collected' => 'Collected',
        // Alternate/legacy workflow keys:
        'production_started' => 'Printing',
        'in_production' => 'Printing',
        'cutting_in_progress' => 'Cutting & Finishing',
        'production_completed' => 'Quality Check & Packaging',
        'ready_for_shipping' => 'Ready for Pickup / Dispatch',
        'dispatched' => 'Handed over to courier',
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
            self::PRINTING, self::IN_PRODUCTION, self::PRODUCTION_STARTED => 'Printing',
            self::CUTTING_AND_FINISHING, self::CUTTING_IN_PROGRESS => 'Cutting & Finishing',
            self::QUALITY_CHECK_AND_PACKAGING, self::PRODUCTION_COMPLETED => 'Quality Check & Packaging',
            self::READY_FOR_PICKUP => 'Ready for Pickup',
            self::READY_FOR_SHIPPING => 'Ready for Pickup / Dispatch',
            self::DISPATCHED, self::HANDED_OVER_TO_COURIER => 'Handed over to courier',
            self::DELIVERED => 'Delivered',
            self::COLLECTED => 'Collected',
            self::CANCELLED => 'Cancelled',
            self::REFUNDED => 'Refunded',
        };
    }
}
