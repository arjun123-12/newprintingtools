<?php

namespace App\Enums;

enum ArtworkStatus: string
{
    case UPLOADED = 'uploaded';
    case PREFLIGHT_PASSED = 'preflight_passed';
    case PREFLIGHT_WARNING = 'preflight_warning';
    case PREFLIGHT_FAILED = 'preflight_failed';
    case CUSTOMER_APPROVED = 'customer_approved';
    case READY_FOR_PRODUCTION = 'ready_for_production';
    case REJECTED = 'rejected';
}
