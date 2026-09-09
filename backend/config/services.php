<?php

return [

    'freepik' => [
        'api_key' => env('EXTERNAL_ASSET_API_TWO_KEY', env('FREEPIK_API_KEY', 'MS298ef362fc4148869212e3ba881f6bf2')),
        'api_url' => env('EXTERNAL_ASSET_API_TWO_BASE_URL', env('FREEPIK_API_URL', 'https://api.magnific.com/v1')),
    ],

    'magnific' => [
        'api_key' => env('EXTERNAL_ASSET_API_ONE_KEY', 'MS298ef362fc4148869212e3ba881f6bf2'),
        'api_url' => env('EXTERNAL_ASSET_API_ONE_BASE_URL', 'https://api.magnific.com/v1'),
    ],

];