<?php

namespace App\Http\Controllers\Api\V1\Enquiries;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enquiries\StoreCustomerEnquiryRequest;
use App\Http\Requests\Enquiries\UpdateCustomerEnquiryRequest;
use App\Models\CustomerEnquiry;
use App\Models\CustomerEnquiryMessage;
use App\Services\AI\AiSupportChatService;
use App\Services\Notification\OrderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerEnquiryController extends Controller
{
    /**
     * Store a new public customer enquiry.
     */
    public function store(StoreCustomerEnquiryRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $reference = CustomerEnquiry::generateReference();
        $storedAttachment = null;
        $attachmentOriginalName = null;
        $attachmentMime = null;
        $attachmentSize = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $extension = strtolower($file->getClientOriginalExtension());
            $filename = Str::uuid() . ($extension ? '.' . $extension : '');
            $path = $file->storeAs('enquiries/' . $reference, $filename, 'public');

            if ($path) {
                $storedAttachment = $path;
                $attachmentOriginalName = $file->getClientOriginalName();
                $attachmentMime = $file->getMimeType();
                $attachmentSize = $file->getSize();
            }
        }

        // Parse specifications if stringified JSON
        $specifications = $validated['specifications'] ?? null;
        if (is_string($specifications)) {
            $decoded = json_decode($specifications, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $specifications = $decoded;
            }
        }

        $enquiry = CustomerEnquiry::create([
            'reference' => $reference,
            'name' => strip_tags(trim($validated['name'])),
            'email' => strtolower(trim($validated['email'])),
            'phone' => isset($validated['phone']) ? strip_tags(trim($validated['phone'])) : null,
            'product_id' => $validated['product_id'] ?? null,
            'product_name' => isset($validated['product_name']) ? strip_tags(trim($validated['product_name'])) : null,
            'quantity' => isset($validated['quantity']) ? (int) $validated['quantity'] : null,
            'specifications' => $specifications,
            'delivery_location' => isset($validated['delivery_location']) ? strip_tags(trim($validated['delivery_location'])) : null,
            'additional_requirements' => isset($validated['additional_requirements']) ? strip_tags(trim($validated['additional_requirements'])) : null,
            'source_url' => isset($validated['source_url']) ? filter_var($validated['source_url'], FILTER_SANITIZE_URL) : null,
            'attachment_path' => $storedAttachment,
            'attachment_original_name' => $attachmentOriginalName,
            'attachment_mime_type' => $attachmentMime,
            'attachment_size_bytes' => $attachmentSize,
            'status' => CustomerEnquiry::STATUS_NEW,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
        ]);

        // Record initial customer project requirements as the first message in the chat
        $initialText = !empty($enquiry->additional_requirements)
            ? $enquiry->additional_requirements
            : ("Customer requested a quote for " . ($enquiry->product_name ?: 'custom printing') . ($enquiry->quantity ? " (" . number_format($enquiry->quantity) . " units)" : "") . ".");

        $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_CUSTOMER,
            'sender_name' => $enquiry->name,
            'message' => $initialText,
            'attachment_path' => $storedAttachment,
            'attachment_original_name' => $attachmentOriginalName,
            'attachment_mime_type' => $attachmentMime,
            'attachment_size_bytes' => $attachmentSize,
            'is_read_by_admin' => false,
            'is_read_by_customer' => true,
            'ip_address' => $request->ip(),
        ]);

        // Send enquiry notification to linked store staff and customer confirmation
        try {
            (new OrderNotificationService())->sendCustomerEnquiryNotification($enquiry);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Could not dispatch enquiry notifications for {$enquiry->reference}: {$e->getMessage()}", [
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Thank you for your enquiry. Our team will review your specifications and contact you shortly with a tailored quote.',
            'data' => [
                'id' => $enquiry->id,
                'reference' => $enquiry->reference,
                'name' => $enquiry->name,
                'email' => $enquiry->email,
                'product_name' => $enquiry->product_name,
                'status' => $enquiry->status,
                'conversation_url' => $enquiry->conversation_url,
                'created_at' => $enquiry->created_at->toISOString(),
            ],
        ], 201);
    }

    /**
     * Admin: List customer enquiries with filtering, pagination and counts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $query = CustomerEnquiry::query();

        // Status filter
        if ($request->input('status') === 'needs_followup') {
            $query->where('needs_human_followup', true);
        } elseif ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        // Search filter
        if ($request->filled('search')) {
            $search = '%' . trim($request->input('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                  ->orWhere('email', 'like', $search)
                  ->orWhere('phone', 'like', $search)
                  ->orWhere('reference', 'like', $search)
                  ->orWhere('product_name', 'like', $search);
            });
        }

        // Calculate counts by status for tabs
        $statusCounts = CustomerEnquiry::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $totalCount = CustomerEnquiry::count();
        $needsFollowupCount = CustomerEnquiry::where('needs_human_followup', true)->count();

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $enquiries = $query->latest('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $enquiries->items(),
            'meta' => [
                'current_page' => $enquiries->currentPage(),
                'last_page' => $enquiries->lastPage(),
                'per_page' => $enquiries->perPage(),
                'total' => $enquiries->total(),
            ],
            'stats' => array_merge([
                'all' => $totalCount,
                'new' => $statusCounts['new'] ?? 0,
                'contacted' => $statusCounts['contacted'] ?? 0,
                'quoted' => $statusCounts['quoted'] ?? 0,
                'converted' => $statusCounts['converted'] ?? 0,
                'closed' => $statusCounts['closed'] ?? 0,
                'needs_followup' => $needsFollowupCount,
            ], $statusCounts),
        ]);
    }

    /**
     * Admin: View details of a specific enquiry.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $enquiry = CustomerEnquiry::with('messages')->find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

        // Mark unread customer messages as read by admin
        $enquiry->messages()->where('sender_type', CustomerEnquiryMessage::SENDER_CUSTOMER)->where('is_read_by_admin', false)->update(['is_read_by_admin' => true]);

        return response()->json([
            'success' => true,
            'data' => $enquiry,
        ]);
    }

    /**
     * Admin: Update status or notes for an enquiry.
     */
    public function update(UpdateCustomerEnquiryRequest $request, int|string $id): JsonResponse
    {
        $enquiry = CustomerEnquiry::find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

        $validated = $request->validated();

        if (isset($validated['status'])) {
            $enquiry->status = $validated['status'];
        }

        if (array_key_exists('admin_notes', $validated)) {
            $enquiry->admin_notes = $validated['admin_notes'];
        }

        $enquiry->save();

        return response()->json([
            'success' => true,
            'message' => 'Enquiry updated successfully.',
            'data' => $enquiry,
        ]);
    }

    /**
     * Admin: Delete an enquiry.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Administrator access required.',
            ], 403);
        }

        $enquiry = CustomerEnquiry::find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

        if ($enquiry->attachment_path) {
            Storage::disk('public')->delete($enquiry->attachment_path);
        }

        // Also clean up any message attachments
        foreach ($enquiry->messages as $msg) {
            if ($msg->attachment_path) {
                Storage::disk('public')->delete($msg->attachment_path);
            }
        }

        $enquiry->delete();

        return response()->json([
            'success' => true,
            'message' => 'Enquiry deleted successfully.',
        ]);
    }

    /**
     * Admin: Fetch all messages for a specific enquiry and mark as read.
     */
    public function getAdminMessages(Request $request, int|string $id): JsonResponse
    {
        $enquiry = CustomerEnquiry::with('messages')->find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

        // Mark unread customer messages as read by admin
        $enquiry->messages()->where('sender_type', CustomerEnquiryMessage::SENDER_CUSTOMER)->where('is_read_by_admin', false)->update(['is_read_by_admin' => true]);

        return response()->json([
            'success' => true,
            'data' => $enquiry->messages()->get(),
        ]);
    }

    /**
     * Admin: Send a message reply to the customer.
     */
    public function sendAdminMessage(Request $request, int|string $id): JsonResponse
    {
        $enquiry = CustomerEnquiry::find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

        $validated = $request->validate([
            'message' => ['required_without:attachment', 'nullable', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:26214', 'mimes:pdf,png,jpg,jpeg,webp,ai,eps,psd,tif,tiff'],
        ], [
            'message.required_without' => 'Please provide a message or attach a file.',
            'attachment.max' => 'Attachment file size must not exceed 25MB.',
            'attachment.mimes' => 'Attachment must be a valid document or artwork file (PDF, PNG, JPG, WebP, AI, EPS, PSD, TIFF).',
        ]);

        $storedAttachment = null;
        $attachmentOriginalName = null;
        $attachmentMime = null;
        $attachmentSize = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $extension = strtolower($file->getClientOriginalExtension());
            $filename = Str::uuid() . ($extension ? '.' . $extension : '');
            $path = $file->storeAs('enquiries/' . $enquiry->reference . '/staff', $filename, 'public');

            if ($path) {
                $storedAttachment = $path;
                $attachmentOriginalName = $file->getClientOriginalName();
                $attachmentMime = $file->getMimeType();
                $attachmentSize = $file->getSize();
            }
        }

        $user = $request->user();
        $senderName = $user?->name ?: 'Erry Imprints Prepress Team';

        // 1. Save reply in database first
        $message = $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_ADMIN,
            'sender_name' => $senderName,
            'sender_id' => $user?->id,
            'message' => trim($validated['message'] ?? ''),
            'attachment_path' => $storedAttachment,
            'attachment_original_name' => $attachmentOriginalName,
            'attachment_mime_type' => $attachmentMime,
            'attachment_size_bytes' => $attachmentSize,
            'is_read_by_admin' => true,
            'is_read_by_customer' => false,
            'ip_address' => $request->ip(),
        ]);

        // Update enquiry timestamps and status
        $enquiry->last_message_at = now();
        $enquiry->needs_human_followup = false;
        if ($request->has('is_ai_enabled')) {
            $enquiry->is_ai_enabled = $request->boolean('is_ai_enabled');
        } elseif ($request->boolean('pause_ai')) {
            $enquiry->is_ai_enabled = false;
        }
        if ($enquiry->status === CustomerEnquiry::STATUS_NEW) {
            $enquiry->status = CustomerEnquiry::STATUS_CONTACTED;
        }
        $enquiry->save();

        // 2. Send email notification to customer with secure conversation link
        try {
            (new OrderNotificationService())->sendAdminReplyToCustomer($enquiry, $message);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Could not send admin reply notification email to customer: {$e->getMessage()}");
        }

        return response()->json([
            'success' => true,
            'message' => 'Reply sent successfully and customer notified via email.',
            'data' => $message,
            'enquiry_status' => $enquiry->status,
            'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
            'needs_human_followup' => (bool) $enquiry->needs_human_followup,
        ], 201);
    }

    /**
     * Public / Customer: View conversation by secure unguessable access_token.
     */
    public function showConversation(Request $request, string $token): JsonResponse
    {
        $enquiry = CustomerEnquiry::where('access_token', $token)->with('messages')->first();

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Conversation not found or link has expired.',
            ], 404);
        }

        // Mark admin and AI messages as read by customer
        $enquiry->messages()
            ->whereIn('sender_type', [CustomerEnquiryMessage::SENDER_ADMIN, CustomerEnquiryMessage::SENDER_AI])
            ->where('is_read_by_customer', false)
            ->update(['is_read_by_customer' => true]);

        return response()->json([
            'success' => true,
            'data' => [
                'reference' => $enquiry->reference,
                'name' => $enquiry->name,
                'email' => $enquiry->email,
                'phone' => $enquiry->phone,
                'product_name' => $enquiry->product_name,
                'quantity' => $enquiry->quantity,
                'specifications' => $enquiry->specifications,
                'delivery_location' => $enquiry->delivery_location,
                'additional_requirements' => $enquiry->additional_requirements,
                'attachment_url' => $enquiry->attachment_url,
                'attachment_original_name' => $enquiry->attachment_original_name,
                'attachment_size_bytes' => $enquiry->attachment_size_bytes,
                'status' => $enquiry->status,
                'needs_human_followup' => (bool) $enquiry->needs_human_followup,
                'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
                'created_at' => $enquiry->created_at->toIso8601String(),
                'formatted_date' => $enquiry->created_at->format('d M Y, h:i A'),
                'messages' => $enquiry->messages()->get(),
            ],
        ]);
    }

    /**
     * Public / Customer: Send reply from the secure conversation page.
     */
    public function sendCustomerMessage(Request $request, string $token): JsonResponse
    {
        $enquiry = CustomerEnquiry::where('access_token', $token)->first();

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Conversation not found or link has expired.',
            ], 404);
        }

        $validated = $request->validate([
            'message' => ['required_without:attachment', 'nullable', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:26214', 'mimes:pdf,png,jpg,jpeg,webp,ai,eps,psd,tif,tiff'],
        ], [
            'message.required_without' => 'Please provide a message or attach a file.',
            'attachment.max' => 'Attachment file size must not exceed 25MB.',
            'attachment.mimes' => 'Attachment must be a valid document or artwork file (PDF, PNG, JPG, WebP, AI, EPS, PSD, TIFF).',
        ]);

        $storedAttachment = null;
        $attachmentOriginalName = null;
        $attachmentMime = null;
        $attachmentSize = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $extension = strtolower($file->getClientOriginalExtension());
            $filename = Str::uuid() . ($extension ? '.' . $extension : '');
            $path = $file->storeAs('enquiries/' . $enquiry->reference . '/customer', $filename, 'public');

            if ($path) {
                $storedAttachment = $path;
                $attachmentOriginalName = $file->getClientOriginalName();
                $attachmentMime = $file->getMimeType();
                $attachmentSize = $file->getSize();
            }
        }

        // 1. Save customer reply in database first
        $message = $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_CUSTOMER,
            'sender_name' => $enquiry->name,
            'message' => trim($validated['message'] ?? ''),
            'attachment_path' => $storedAttachment,
            'attachment_original_name' => $attachmentOriginalName,
            'attachment_mime_type' => $attachmentMime,
            'attachment_size_bytes' => $attachmentSize,
            'is_read_by_admin' => false,
            'is_read_by_customer' => true,
            'ip_address' => $request->ip(),
        ]);

        // Update enquiry timestamps
        $enquiry->last_message_at = now();
        if ($enquiry->status === CustomerEnquiry::STATUS_CLOSED) {
            $enquiry->status = CustomerEnquiry::STATUS_CONTACTED;
        }
        $enquiry->save();

        // 2. Trigger AI auto-reply if enabled and customer sent text
        $aiReply = null;
        if ($enquiry->is_ai_enabled && !empty($message->message)) {
            try {
                $chatService = app(AiSupportChatService::class);
                $aiReply = $chatService->generateReply($enquiry, $message->message);
            } catch (\Throwable $e) {
                Log::warning("AI auto-reply failed for {$enquiry->reference}: {$e->getMessage()}");
            }
        }

        // 3. Email staff that customer replied
        try {
            (new OrderNotificationService())->sendCustomerReplyToAdmin($enquiry, $message);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Could not send customer reply email notification to staff: {$e->getMessage()}");
        }

        $enquiry->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Your reply has been sent.',
            'data' => $message,
            'ai_reply' => $aiReply,
            'needs_human_followup' => (bool) $enquiry->needs_human_followup,
            'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
        ], 201);
    }

    /**
     * Public / Visitor: Send message from the live AI Support Chat widget.
     */
    public function sendChatMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:3000'],
            'token' => ['nullable', 'string', 'size:64'],
            'session_id' => ['nullable', 'string', 'max:100'],
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'product_id' => ['nullable', 'string', 'max:255'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ]);

        $messageText = trim($validated['message']);
        $sessionId = $validated['session_id'] ?? null;
        $token = $validated['token'] ?? null;
        $user = $request->user();

        $enquiry = null;

        // 1. If access token is provided, resume existing conversation
        if ($token) {
            $enquiry = CustomerEnquiry::where('access_token', $token)->first();
            if (!$enquiry) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chat session not found or link has expired.',
                ], 404);
            }

            // Verify ownership if session_id is associated
            if ($sessionId && $enquiry->session_id && $enquiry->session_id !== $sessionId && (!$user || $enquiry->user_id !== $user->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized conversation access.',
                ], 403);
            }
        } elseif ($sessionId) {
            // Find recent active chat enquiry for this visitor session
            $enquiry = CustomerEnquiry::where('session_id', $sessionId)
                ->where('status', '!=', CustomerEnquiry::STATUS_CLOSED)
                ->latest('id')
                ->first();
        }

        // 2. If no enquiry exists, create one linked to visitor session / user
        if (!$enquiry) {
            $customerName = !empty($validated['name']) ? strip_tags(trim($validated['name'])) : ($user?->name ?: 'Website Visitor');
            $customerEmail = !empty($validated['email']) ? strtolower(trim($validated['email'])) : ($user?->email ?: ('visitor_' . substr(md5($sessionId ?: Str::uuid()->toString()), 0, 8) . '@guest.erryimprints.com.au'));

            $enquiry = CustomerEnquiry::create([
                'reference' => CustomerEnquiry::generateReference(),
                'name' => $customerName,
                'email' => $customerEmail,
                'session_id' => $sessionId,
                'user_id' => $user?->id,
                'channel' => 'web_chat',
                'product_id' => $validated['product_id'] ?? null,
                'product_name' => $validated['product_name'] ?? null,
                'status' => CustomerEnquiry::STATUS_NEW,
                'is_ai_enabled' => true,
                'needs_human_followup' => false,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 500),
            ]);
        } else {
            // Link user if authenticated now and not previously linked
            if ($user && empty($enquiry->user_id)) {
                $enquiry->user_id = $user->id;
                if (str_contains($enquiry->email, '@guest.')) {
                    $enquiry->email = $user->email;
                    $enquiry->name = $user->name ?: $enquiry->name;
                }
                $enquiry->save();
            }
        }

        // 3. Save customer message
        $customerMsg = $enquiry->messages()->create([
            'sender_type' => CustomerEnquiryMessage::SENDER_CUSTOMER,
            'sender_name' => $enquiry->name,
            'message' => $messageText,
            'is_read_by_admin' => false,
            'is_read_by_customer' => true,
            'ip_address' => $request->ip(),
        ]);

        $enquiry->last_message_at = now();
        $enquiry->save();

        // 4. Generate AI Reply if AI is enabled
        $aiMsg = null;
        if ($enquiry->is_ai_enabled) {
            try {
                $chatService = app(AiSupportChatService::class);
                $aiMsg = $chatService->generateReply($enquiry, $messageText, $validated['idempotency_key'] ?? null);
            } catch (\Throwable $e) {
                Log::warning("AI reply generation failed: {$e->getMessage()}");
            }
        }

        $enquiry->refresh();

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $enquiry->access_token,
                'reference' => $enquiry->reference,
                'customer_message' => $customerMsg,
                'ai_message' => $aiMsg,
                'needs_human_followup' => (bool) $enquiry->needs_human_followup,
                'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
                'conversation_url' => $enquiry->conversation_url,
            ],
        ], 201);
    }

    /**
     * Public / Visitor: Fetch chat conversation history by token or session_id.
     */
    public function getChatHistory(Request $request): JsonResponse
    {
        $token = $request->query('token');
        $sessionId = $request->query('session_id');

        $query = CustomerEnquiry::query();

        if ($token) {
            $query->where('access_token', $token);
        } elseif ($sessionId) {
            $query->where('session_id', $sessionId)
                ->where('status', '!=', CustomerEnquiry::STATUS_CLOSED)
                ->latest('id');
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Please provide a valid token or session_id.',
            ], 400);
        }

        $enquiry = $query->with('messages')->first();

        if (!$enquiry) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        // Mark admin and AI messages as read by customer
        $enquiry->messages()
            ->whereIn('sender_type', [CustomerEnquiryMessage::SENDER_ADMIN, CustomerEnquiryMessage::SENDER_AI])
            ->where('is_read_by_customer', false)
            ->update(['is_read_by_customer' => true]);

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $enquiry->access_token,
                'reference' => $enquiry->reference,
                'name' => $enquiry->name,
                'email' => $enquiry->email,
                'status' => $enquiry->status,
                'needs_human_followup' => (bool) $enquiry->needs_human_followup,
                'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
                'created_at' => $enquiry->created_at->toIso8601String(),
                'messages' => $enquiry->messages()->get(),
            ],
        ]);
    }

    /**
     * Admin: Toggle AI auto-reply for a specific enquiry.
     */
    public function toggleAi(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized. Administrator access required.'], 403);
        }

        $enquiry = CustomerEnquiry::find($id);
        if (!$enquiry) {
            return response()->json(['success' => false, 'message' => 'Enquiry not found.'], 404);
        }

        $newState = $request->has('is_ai_enabled') ? $request->boolean('is_ai_enabled') : !$enquiry->is_ai_enabled;
        $enquiry->is_ai_enabled = $newState;
        $enquiry->save();

        return response()->json([
            'success' => true,
            'message' => $newState ? 'AI auto-reply enabled for this conversation.' : 'AI auto-reply paused. Admin takeover active.',
            'data' => [
                'is_ai_enabled' => (bool) $enquiry->is_ai_enabled,
            ],
        ]);
    }

    /**
     * Admin: Mark human follow-up request as resolved.
     */
    public function resolveFollowup(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized. Administrator access required.'], 403);
        }

        $enquiry = CustomerEnquiry::find($id);
        if (!$enquiry) {
            return response()->json(['success' => false, 'message' => 'Enquiry not found.'], 404);
        }

        $enquiry->needs_human_followup = false;
        $enquiry->save();

        return response()->json([
            'success' => true,
            'message' => 'Human follow-up marked as resolved.',
            'data' => [
                'needs_human_followup' => false,
            ],
        ]);
    }

    /**
     * Admin: Get notification count of new / unread customer enquiries.
     */
    public function getNotificationCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        $afterId = $request->query('after_id');
        $since = $request->query('since');

        $latestEnquiry = CustomerEnquiry::latest('id')->first(['id', 'created_at']);

        // Total count of enquiries with status 'new'
        $totalNew = CustomerEnquiry::where('status', CustomerEnquiry::STATUS_NEW)->count();

        // Count of unread customer messages across all enquiries
        $unreadMessagesCount = CustomerEnquiryMessage::where('sender_type', CustomerEnquiryMessage::SENDER_CUSTOMER)
            ->where('is_read_by_admin', false)
            ->count();

        // If after_id or since is provided, calculate how many new enquiries arrived after that point
        if ($afterId !== null && $afterId !== '') {
            $count = CustomerEnquiry::where('id', '>', (int) $afterId)->count();
        } elseif ($since !== null && $since !== '') {
            try {
                $sinceDate = \Carbon\Carbon::parse($since);
                $count = CustomerEnquiry::where('created_at', '>', $sinceDate)->count();
            } catch (\Throwable $e) {
                $count = $totalNew;
            }
        } else {
            $count = $totalNew;
        }

        return response()->json([
            'success' => true,
            'count' => $count,
            'total_new' => $totalNew,
            'unread_messages' => $unreadMessagesCount,
            'latest_id' => $latestEnquiry ? $latestEnquiry->id : 0,
            'latest_created_at' => $latestEnquiry ? $latestEnquiry->created_at->toIso8601String() : null,
        ]);
    }

    /**
     * Admin: Mark all customer enquiry messages as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        CustomerEnquiryMessage::where('sender_type', CustomerEnquiryMessage::SENDER_CUSTOMER)
            ->where('is_read_by_admin', false)
            ->update(['is_read_by_admin' => true]);

        return response()->json([
            'success' => true,
            'message' => 'All enquiry messages marked as read.',
        ]);
    }
}

