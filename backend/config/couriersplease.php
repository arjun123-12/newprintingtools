<?php

return [
    /*
    |--------------------------------------------------------------------------
    | CouriersPlease API Environment & Credentials
    |--------------------------------------------------------------------------
    |
    | Supported environments: 'sandbox' (api-test.couriersplease.com.au)
    | or 'production' (api.couriersplease.com.au).
    |
    */
    'environment' => env('COURIERS_PLEASE_ENVIRONMENT', 'sandbox'),

    'account_number' => env('COURIERS_PLEASE_ACCOUNT_NUMBER', ''),
    'api_key' => env('COURIERS_PLEASE_API_KEY', ''),

    'base_urls' => [
        'sandbox' => 'https://api-test.couriersplease.com.au',
        'production' => 'https://api.couriersplease.com.au',
    ],

    /*
    |--------------------------------------------------------------------------
    | Dispatch / Origin Configuration
    |--------------------------------------------------------------------------
    |
    | Do NOT assume Sydney 2000. CouriersPlease quotes and shipments require
    | a valid Australian sender/dispatch suburb and postcode. Quoting will
    | verify this configuration before making live requests.
    |
    */
    'dispatch' => [
        'suburb' => env('COURIERS_PLEASE_DISPATCH_SUBURB', null),
        'postcode' => env('COURIERS_PLEASE_DISPATCH_POSTCODE', null),
        'state' => env('COURIERS_PLEASE_DISPATCH_STATE', null),
        'name' => env('COURIERS_PLEASE_DISPATCH_NAME', 'Erry Imprints Dispatch'),
        'company_name' => env('COURIERS_PLEASE_DISPATCH_COMPANY', 'Erry Imprints'),
        'phone' => env('COURIERS_PLEASE_DISPATCH_PHONE', '0400 000 000'),
        'email' => env('COURIERS_PLEASE_DISPATCH_EMAIL', 'Info@erryimprints.com.au'),
        'address1' => env('COURIERS_PLEASE_DISPATCH_ADDRESS1', '123 Printing Way'),
        'address2' => env('COURIERS_PLEASE_DISPATCH_ADDRESS2', null),
        'is_business' => env('COURIERS_PLEASE_DISPATCH_IS_BUSINESS', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature Flags & Defaults
    |--------------------------------------------------------------------------
    */
    'enable_delivery_choices' => env('COURIERS_PLEASE_ENABLE_DELIVERY_CHOICES', false),
    'enable_pickups' => env('COURIERS_PLEASE_ENABLE_PICKUPS', false),
    'default_rate_card' => env('COURIERS_PLEASE_DEFAULT_RATE_CARD', 'L55'),
    'timeout_seconds' => env('COURIERS_PLEASE_TIMEOUT', 15),
    'ssl_verify' => env('COURIERS_PLEASE_SSL_VERIFY', false),
];
