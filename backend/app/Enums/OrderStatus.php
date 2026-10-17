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
    case DISPATCHED = 'dispatched';
    case DELIVERED = 'delivered';
    case CANCELLED = 'cancelled';
    case REFUNDED = 'refunded';
}
