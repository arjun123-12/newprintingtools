<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AdminAssistantController extends Controller
{
    public function interpret(Request $request): JsonResponse
    {
        $validated = $request->validate(['command' => ['required', 'string', 'min:3', 'max:3000']]);
        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            return response()->json(['success' => false, 'message' => 'Voice assistant needs OPENAI_API_KEY configured in the backend environment.'], 503);
        }

        $baseUrl = rtrim(config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
        try {
            $response = Http::withToken($apiKey)
                ->timeout((int) config('services.openai.timeout', 30))
                ->post($baseUrl . '/chat/completions', [
                'model' => config('services.openai.model', 'gpt-4o-mini'),
                'response_format' => ['type' => 'json_object'],
                'temperature' => 0,
                'messages' => [
                    ['role' => 'system', 'content' => 'Extract an admin print-shop request into JSON only. Never invent or calculate prices. Return keys: action (quote|order|unknown), customer_name, customer_email, company_name, customer_phone, product_items (array of {product_name, quantity, specifications, unit_price_ex_gst}), delivery_method, delivery_address, customer_notes, internal_notes, send_to_customer (boolean), clarification. Only set a price if the admin explicitly said it. If a required detail is missing, write a short clarification question. An explicit request to email/send/share a quote or order link sets send_to_customer true. Create quote when user says quote/estimate; order when they explicitly say order.'],
                    ['role' => 'user', 'content' => $validated['command']],
                ],
                ]);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['success' => false, 'message' => 'Assistant service is temporarily unavailable. Please try again or type the command manually.'], 502);
        }

        if ($response->failed()) {
            return response()->json(['success' => false, 'message' => 'Assistant could not interpret that command. Please try again or type it more clearly.'], 502);
        }

        $content = $response->json('choices.0.message.content');
        $draft = is_string($content) ? json_decode($content, true) : null;
        if (!is_array($draft)) {
            return response()->json(['success' => false, 'message' => 'Assistant returned an unreadable response. Please try the command again.'], 502);
        }

        $customerName = trim((string) ($draft['customer_name'] ?? ''));
        $customerEmail = trim((string) ($draft['customer_email'] ?? ''));
        $customers = User::query()->where('role', User::ROLE_CUSTOMER)
            ->where(function ($query) use ($customerName, $customerEmail) {
                if ($customerName !== '') $query->orWhere('name', 'like', '%' . addcslashes($customerName, '%_') . '%')->orWhere('company_name', 'like', '%' . addcslashes($customerName, '%_') . '%');
                if ($customerEmail !== '') $query->orWhere('email', strtolower($customerEmail));
                if ($customerName === '' && $customerEmail === '') $query->whereRaw('1 = 0');
            })->limit(8)->get(['id', 'name', 'email', 'phone', 'company_name']);

        $items = collect($draft['product_items'] ?? [])->take(20)->map(function ($item) {
            $name = trim((string) ($item['product_name'] ?? ''));
            $productQuery = Product::query()->where('is_active', true);
            if ($name !== '') {
                $productQuery->where(function ($query) use ($name) {
                    $query->where('name', 'like', '%' . addcslashes($name, '%_') . '%')->orWhere('sku', $name);
                });
            } else {
                $productQuery->whereRaw('1 = 0');
            }
            $matches = $productQuery->limit(8)->get(['id', 'name', 'sku', 'base_price', 'sale_price']);
            return [
                'product_name' => $name,
                'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                'specifications' => trim((string) ($item['specifications'] ?? '')),
                'unit_price_ex_gst' => is_numeric($item['unit_price_ex_gst'] ?? null) ? (float) $item['unit_price_ex_gst'] : null,
                'matches' => $matches,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'action' => in_array($draft['action'] ?? '', ['quote', 'order'], true) ? $draft['action'] : 'unknown',
                'customer' => [
                    'name' => trim((string) ($draft['customer_name'] ?? '')),
                    'email' => strtolower(trim((string) ($draft['customer_email'] ?? ''))),
                    'company_name' => trim((string) ($draft['company_name'] ?? '')),
                    'phone' => trim((string) ($draft['customer_phone'] ?? '')),
                    'matches' => $customers,
                ],
                'items' => $items,
                'delivery_method' => trim((string) ($draft['delivery_method'] ?? 'Standard delivery (Free)')),
                'delivery_address' => trim((string) ($draft['delivery_address'] ?? '')),
                'customer_notes' => trim((string) ($draft['customer_notes'] ?? '')),
                'internal_notes' => trim((string) ($draft['internal_notes'] ?? '')),
                'send_to_customer' => (bool) ($draft['send_to_customer'] ?? false),
                'clarification' => trim((string) ($draft['clarification'] ?? '')),
            ],
        ]);
    }
}
