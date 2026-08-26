<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PENDING_PAYMENT = 'pending_payment';
    case PROCESSING = 'processing';
    case ARTWORK_REQUIRED = 'artwork_required';
    case ARTWORK_REVIEW = 'artwork_review';
    case IN_PRODUCTION = 'in_production';
    case DISPATCHED = 'dispatched';
    case DELIVERED = 'delivered';
    case CANCELLED = 'cancelled';
    case REFUNDED = 'refunded';
}
