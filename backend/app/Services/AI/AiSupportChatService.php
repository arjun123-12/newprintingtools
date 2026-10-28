<?php

namespace App\Services\AI;

use App\Models\CustomerEnquiry;
use App\Models\CustomerEnquiryMessage;
use App\Models\Product;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiSupportChatService
{
    /**
     * Special internal token indicating human escalation is needed.
     */
    public const ESCALATION_TAG = '[ESCALATE_HUMAN]';

    /**
     * Generate an AI support reply for the customer conversation.
     *
     * @param CustomerEnquiry $enquiry
     * @param string $customerMessageText
     * @param string|null $idempotencyKey
     * @return CustomerEnquiryMessage
     */
    public function generateReply(CustomerEnquiry $enquiry, string $customerMessageText, ?string $idempotencyKey = null): CustomerEnquiryMessage
    {
        // 1. Idempotency & Debounce check: prevent double-processing on rapid client retries
        $cacheKey = 'ai_chat_debounce_' . $enquiry->id . '_' . sha1($customerMessageText . ($idempotencyKey ?? ''));
        $existingMessageId = Cache::get($cacheKey);
        if ($existingMessageId) {
            $existingMessage = CustomerEnquiryMessage::find($existingMessageId);
            if ($existingMessage) {
                return $existingMessage;
            }
        }

        // 2. Check if customer explicitly requested human escalation in this message
        $wantsHuman = $this->detectHumanRequest($customerMessageText);

        // 3. Obtain AI response from OpenAI Responses / Chat Completions API
        $apiKey = config('services.openai.api_key');
        $replyText = '';
        $shouldEscalate = $wantsHuman;

        if (empty($apiKey)) {
            // Graceful fallback when API key is not yet configured on server
            Log::info("OpenAI API key not set. Using fallback assistant response for Enquiry #{$enquiry->reference}");
            $replyText = "Hello! Thank you for contacting Erry Imprints. Our support team has received your message and will review it shortly. If you need immediate assistance with an urgent job, please feel free to email info@erryimprints.com.au.";
            $shouldEscalate = true;
        } else {
            try {
                $aiResult = $this->callOpenAi($enquiry, $customerMessageText, $wantsHuman);
                $replyText = $aiResult['text'];
                if ($aiResult['escalate']) {
                    $shouldEscalate = true;
                }
            } catch (\Throwable $e) {
                Log::error("OpenAI Support Chat failed for Enquiry #{$enquiry->reference}: {$e->getMessage()}", [
                    'enquiry_id' => $enquiry->id,
                ]);

                $replyText = "Thank you for your message! Our prepress team has received your inquiry and will follow up with you directly. You can also reach us directly at info@erryimprints.com.au.";
                $shouldEscalate = true;
            }
        }

        // 4. Clean up any internal escalation tags from final customer text
        $cleanedText = trim(str_replace(self::ESCALATION_TAG, '', $replyText));
        if (empty($cleanedText)) {
            $cleanedText = "Thank you for reaching out to Erry Imprints. Our team has received your query and will assist you shortly.";
        }

        // 5. Save the AI reply as a CustomerEnquiryMessage in the database
        $aiMessage = $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_AI,
            'sender_name' => 'Erry AI Support',
            'message' => $cleanedText,
            'is_read_by_admin' => false,
            'is_read_by_customer' => false,
            'ip_address' => '127.0.0.1',
        ]);

        // 6. Update enquiry metadata: human follow-up flag, last message timestamp
        $updates = [
            'last_message_at' => now(),
        ];
        if ($shouldEscalate) {
            $updates['needs_human_followup'] = true;
        }
        if ($enquiry->status === CustomerEnquiry::STATUS_NEW) {
            $updates['status'] = CustomerEnquiry::STATUS_CONTACTED;
        }
        $enquiry->update($updates);

        // 7. Store idempotency cache for 60 seconds
        Cache::put($cacheKey, $aiMessage->id, now()->addSeconds(60));

        return $aiMessage;
    }

    /**
     * Check if customer's prompt explicitly requests human agent intervention.
     */
    public function detectHumanRequest(string $text): bool
    {
        $patterns = [
            '/\b(human|agent|person|representative|staff|support team|operator|manager|real person|talk to someone|call me|speak to someone)\b/i',
            '/\b(speak with|talk with|chat with) (a |an )?(human|person|agent|representative)\b/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Dispatch request to OpenAI Chat Completions or Responses API.
     *
     * @param CustomerEnquiry $enquiry
     * @param string $currentMessage
     * @param bool $forceEscalation
     * @return array{text: string, escalate: bool}
     */
    protected function callOpenAi(CustomerEnquiry $enquiry, string $currentMessage, bool $forceEscalation = false): array
    {
        $apiKey = config('services.openai.api_key');
        $model = config('services.openai.model', 'gpt-4o-mini');
        $baseUrl = rtrim(config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
        $timeout = (int) config('services.openai.timeout', 30);

        $systemPrompt = $this->buildSystemPrompt();

        // Build conversation history (last 10 messages for context)
        $history = [];
        $recentMessages = $enquiry->messages()
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->reverse();

        foreach ($recentMessages as $msg) {
            $role = ($msg->sender_type === CustomerEnquiryMessage::SENDER_CUSTOMER) ? 'user' : 'assistant';
            $history[] = [
                'role' => $role,
                'content' => (string) $msg->message,
            ];
        }

        // If the latest customer message isn't in history yet, append it
        $lastHistory = end($history);
        if (!$lastHistory || $lastHistory['content'] !== $currentMessage) {
            $history[] = [
                'role' => 'user',
                'content' => $currentMessage,
            ];
        }

        $messages = array_merge([
            ['role' => 'system', 'content' => $systemPrompt],
        ], $history);

        // If customer explicitly requested human, add instruction
        if ($forceEscalation) {
            $messages[] = [
                'role' => 'system',
                'content' => 'The customer has asked for a human staff member. Reassure them empathetically that an agent from our prepress team has been notified and will follow up shortly, and include ' . self::ESCALATION_TAG . ' in your response.',
            ];
        }

        // Call OpenAI
        $url = $baseUrl . '/chat/completions';
        $http = Http::withToken($apiKey)->timeout($timeout);
        if (file_exists(storage_path('cacert.pem'))) {
            $http = $http->withOptions(['verify' => storage_path('cacert.pem')]);
        }

        $response = $http->post($url, [
            'model' => $model,
            'messages' => $messages,
            'temperature' => 0.3,
            'max_tokens' => 500,
        ]);

        if ($response->failed()) {
            throw new \RuntimeException('OpenAI API responded with HTTP ' . $response->status() . ': ' . $response->body());
        }

        $data = $response->json();
        $aiContent = $data['choices'][0]['message']['content'] ?? '';

        $escalate = str_contains($aiContent, self::ESCALATION_TAG) || $forceEscalation;

        return [
            'text' => $aiContent,
            'escalate' => $escalate,
        ];
    }

    /**
     * Build the grounded business context and guardrail instructions for OpenAI.
     */
    public function buildSystemPrompt(): string
    {
        $productsContext = $this->getCatalogContext();

        return <<<PROMPT
You are "Erry AI Support", the helpful and polite customer support assistant for **Erry Imprints**, a premier commercial and trade printing business in Australia.

### BUSINESS INFORMATION & POLICIES (GROUND TRUTH):
- **Company Name**: Erry Imprints
- **Website / Services**: High-grade business stationery, marketing collateral, banners, brochures, flyers, booklets, stickers, and custom promo merchandise.
- **Support Email**: info@erryimprints.com.au
- **Operating Hours**: Monday to Friday, 8:30am - 5:30pm AEST (Closed Australian Public Holidays).
- **Production Hubs**: Adelaide SA, Melbourne VIC, Sydney NSW.
- **Delivery**: Fast Australia-wide delivery via CouriersPlease and express road freight.
- **Pricing & Currency**: All prices are in Australian Dollars (AUD). Australian Tax Invoices include 10% GST. Wholesale trade quantity breaks are available.
- **Artwork & Prepress Proofing**:
  - 100% Prepress Check on every print file.
  - Accepted file formats: Print-ready PDF (recommended), AI, PSD, EPS, TIFF, high-resolution PNG/JPG (minimum 300 DPI with 3mm bleed).
  - Online interactive designer and custom artwork upload available on website.
- **Custom Quotes**: For custom dimensions, high volume orders (10,000+), specialty finishing (spot UV, foil stamping, embossing, custom die-cut), customers can request a formal quote or upload artwork directly.

### APPROVED PRODUCT CATALOG & BASE PRICES:
{$productsContext}

### STRICT GROUNDING & SAFETY RULES:
1. **NEVER INVENT OR HALLUCINATE**:
   - Never invent products, prices, turnaround days, delivery dates, or policies not listed above.
   - If a customer asks for a product, size, finish, or spec not in the catalog, explain clearly that our prepress and estimating team will prepare a tailored quote for them, and end your message with `[ESCALATE_HUMAN]`.
   - Never promise a guaranteed delivery date (e.g. "it will arrive this Friday"). Explain standard production turnaround (typically 3-5 business days depending on product) plus courier transit, and offer to flag it with our team for express handling.
2. **HUMAN ESCALATION**:
   - If the customer asks to speak to a human, person, staff member, agent, or manager, reassure them warmly that our team has been notified, and include `[ESCALATE_HUMAN]` in your response.
   - If you are uncertain or the query cannot be answered accurately from the approved context, politely tell the customer that our team will follow up, and include `[ESCALATE_HUMAN]`.
3. **STYLE & TONE**:
   - Professional, warm, Australian commercial printer tone.
   - Concise and actionable answers. Use bullet points when listing specs or options.
   - Invite them to submit their exact artwork or specifications via the quote form if they have specific requirements.
PROMPT;
    }

    /**
     * Query active products from database to inject dynamic, accurate catalog data.
     */
    protected function getCatalogContext(): string
    {
        try {
            $products = Product::where('is_active', true)
                ->select('id', 'name', 'base_price', 'min_quantity', 'turnaround_days', 'product_type', 'short_description')
                ->take(30)
                ->get();

            if ($products->isEmpty()) {
                return "- Standard Commercial Print Products: Business Cards, Flyers, Brochures, Posters, Banners, Booklets (Contact team for custom specs).";
            }

            $lines = [];
            foreach ($products as $p) {
                $priceStr = $p->base_price ? "Starting from \${$p->base_price} AUD" : "Custom quote";
                $minQtyStr = $p->min_quantity ? "Min qty: {$p->min_quantity}" : "Flexible qty";
                $turnaroundStr = $p->turnaround_days ? "Production: ~{$p->turnaround_days} business days" : "Standard turnaround";
                $lines[] = "- **{$p->name}**: {$priceStr} | {$minQtyStr} | {$turnaroundStr}" . ($p->short_description ? " - {$p->short_description}" : "");
            }

            return implode("\n", $lines);
        } catch (\Throwable $e) {
            return "- Products: Business Cards, Flyers, Folded Leaflets, Posters, Vinyl Banners, Booklets, Stickers (All quoted in AUD).";
        }
    }
}
