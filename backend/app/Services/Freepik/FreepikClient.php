<?php

namespace App\Services\Freepik;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\PendingRequest;

class FreepikClient
{
    protected string $apiKey;
    protected string $apiUrl;

    public function __construct()
    {
        $this->apiKey = config('services.freepik.api_key', 'MS298ef362fc4148869212e3ba881f6bf2');
        $this->apiUrl = config('services.freepik.api_url', 'https://api.magnific.com/v1');
    }

    /**
     * Get a configured HTTP client for Magnific / Freepik API.
     */
    public function client(): PendingRequest
    {
        $request = Http::withoutVerifying()->withHeaders([
            'x-magnific-api-key' => $this->apiKey,
            'x-freepik-api-key' => $this->apiKey,
            'Accept-Language' => 'en-US',
            'Accept' => 'application/json',
        ])
        ->baseUrl($this->apiUrl)
        ->timeout(30);

        if (app()->environment('local')) {
            $request->withoutVerifying();
        }

        return $request;
    }
}