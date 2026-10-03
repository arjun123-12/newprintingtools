<?php

return [

    'freepik' => [
        'api_key' => env('EXTERNAL_ASSET_API_TWO_KEY', env('FREEPIK_API_KEY', 'MS298ef362fc4148869212e3ba881f6bf2')),
        'api_url' => env('EXTERNAL_ASSET_API_TWO_BASE_URL', env('FREEPIK_API_URL', 'https://api.magnific.com/v1')),
    ],

    'magnific' => [
        'api_key' => env('MAGNIFIC_API_KEY', env('EXTERNAL_ASSET_API_ONE_KEY', 'MS298ef362fc4148869212e3ba881f6bf2')),
        'api_url' => env('MAGNIFIC_API_URL', env('EXTERNAL_ASSET_API_ONE_BASE_URL', 'https://api.magnific.com/v1')),
    ],

    
    'bpoint' => [
        'enabled' => env('BPOINT_ENABLED', env('PAYMENT_GATEWAY_ENABLED', false)),
        'base_url' => env('BPOINT_BASE_URL', env('PAYMENT_GATEWAY_BASE_URL', 'https://bpoint.uat.linkly.com.au/rest/v5')),
        'merchant_number' => env('BPOINT_MERCHANT_NUMBER', env('PAYMENT_GATEWAY_MERCHANT_ID', '')),
        'api_username' => env('BPOINT_API_USERNAME', env('PAYMENT_GATEWAY_API_USERNAME', '')),
        'api_password' => env('BPOINT_API_PASSWORD', env('PAYMENT_GATEWAY_API_PASSWORD', '')),
        'client_script_url' => env('BPOINT_CLIENT_SCRIPT_URL', env('PAYMENT_GATEWAY_CLIENT_SCRIPT_URL', 'https://bpoint.uat.linkly.com.au/rest/clientscripts/api.js')),
        'disable_ssl_verify' => env('BPOINT_DISABLE_SSL_VERIFY', false),
    ],

    'payment_gateway' => [
        'enabled' => env('BPOINT_ENABLED', env('PAYMENT_GATEWAY_ENABLED', false)),
        'base_url' => env('BPOINT_BASE_URL', env('PAYMENT_GATEWAY_BASE_URL', 'https://bpoint.uat.linkly.com.au/rest/v5')),
        'merchant_id' => env('BPOINT_MERCHANT_NUMBER', env('PAYMENT_GATEWAY_MERCHANT_ID', '')),
        'api_username' => env('BPOINT_API_USERNAME', env('PAYMENT_GATEWAY_API_USERNAME', '')),
        'api_password' => env('BPOINT_API_PASSWORD', env('PAYMENT_GATEWAY_API_PASSWORD', '')),
        'client_script_url' => env('BPOINT_CLIENT_SCRIPT_URL', env('PAYMENT_GATEWAY_CLIENT_SCRIPT_URL', 'https://bpoint.uat.linkly.com.au/rest/clientscripts/api.js')),
    ],

];