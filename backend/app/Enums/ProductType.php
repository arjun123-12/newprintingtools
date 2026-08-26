<?php

namespace App\Enums;

enum ProductType: string
{
    case STANDARD_PRINT = 'standard_print';
    case CUSTOM_DIMENSION = 'custom_dimension';
    case APPAREL = 'apparel';
    case SIGNAGE = 'signage';
    case STATIONERY = 'stationery';
}
