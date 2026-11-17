<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientBrief;
use App\Models\CustomerRewardLedger;
use App\Models\Product;
use App\Services\Order\ManualOrderService;
use App\Services\Notification\OrderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientBriefController extends Controller
{
    public function index(
        Request $request
    ): JsonResponse {
        $query = ClientBrief::query();
        if ($this->submittedQueriesOnly($request)) {
            $query->whereNotNull('submitted_at');
        }

        $briefs = $query
            ->withCount('files')
            ->select(['id','uuid','token','company_name','request_type','product','quantity','status','is_active','expires_at','submitted_at','created_at','updated_at'])
            ->latest()
            ->paginate(
                $request->integer(
                    'per_page',
                    20
                )
            );

        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/');
        $briefs->getCollection()->transform(function (ClientBrief $brief) use ($frontendUrl) {
            $brief->setAttribute('client_url', $frontendUrl . '/client-brief/' . $brief->token);
            $brief->makeHidden('token');
            return $brief;
        });

        return response()->json([
            'success' => true,
            'data' => $briefs,
        ]);
    }

    public function store(
        Request $request
    ): JsonResponse {
        if ($this->submittedQueriesOnly($request)) {
            return response()->json(['success' => false, 'message' => 'Your role can view submitted customer design queries only.'], 403);
        }

        $validated = $request->validate([
                'expires_in_days' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:90',
                ],
            ]);

        $token =
            Str::random(48);

        $brief =
            ClientBrief::create([
                'uuid' =>
                    (string)
                        Str::uuid(),

                'token' =>
                    $token,

                'status' =>
                    'draft',

                'is_active' =>
                    true,

                'expires_at' =>
                    now()->addDays(
                        $validated[
                            'expires_in_days'
                        ] ?? 7
                    ),
            ]);

        $frontendUrl =
            rtrim(
                config(
                    'app.frontend_url',
                    env(
                        'FRONTEND_URL',
                        'http://localhost:3000'
                    )
                ),
                '/'
            );

        $clientUrl =
            $frontendUrl .
            '/client-brief/' .
            $token;

        return response()->json([
            'success' => true,

            'message' =>
                'Private client brief created.',

            'data' => [
                'id' =>
                    $brief->id,

                'uuid' =>
                    $brief->uuid,

                'status' =>
                    $brief->status,

                'expires_at' =>
                    $brief
                        ->expires_at
                        ?->toISOString(),

                'client_url' =>
                    $clientUrl,
            ],
        ], 201);
    }

    public function show(
        Request $request,
        int $id
    ): JsonResponse {
        $brief =
            $this->briefsVisibleTo($request)
                ->with(['files', 'messages', 'rewardLedger.spinReward'])
                ->findOrFail($id);

        $payload = $brief->only([
            'id','uuid','company_name','request_type','reorder_reference','project_name','product','quantity',
            'width','height','unit','print_sides','colours','description',
            'additional_notes','requested_date','status','is_active','expires_at','submitted_at',
            'created_at','updated_at','design_fee','design_fee_accepted_at',
        ]);
        $linkedOrder = $brief->order()->with('activeReviewLink')->first(['id', 'order_number', 'status', 'payment_status']);
        $reviewLink = $linkedOrder?->activeReviewLink;

        return response()->json([
            'success' => true,

            'data' => [
                ...$payload,

                'files' =>
                    $brief->files
                        ->map(
                            fn ($file) => [
                                'id' =>
                                    $file->id,

                                'name' =>
                                    $file
                                        ->original_name,

                                'mime_type' =>
                                    $file
                                        ->mime_type,

                                'file_type' => $file->file_type,

                                'size_bytes' =>
                                    $file
                                        ->size_bytes,

                                'url' =>
                                    url(
                                        '/storage/' .
                                            ltrim(
                                                $file
                                                    ->file_path,
                                                '/'
                                            )
                                    ),
                            ]
                        ),
                'messages' => $brief->messages->map(fn ($message) => [
                    'id' => $message->id, 'author' => $message->author,
                    'message' => $message->message, 'attachment_url' => $message->attachment_url,
                    'attachment_name' => $message->attachment_name, 'attachment_mime_type' => $message->attachment_mime_type,
                    'created_at' => $message->created_at,
                ]),
                'spin_reward' => $brief->rewardLedger ? [
                    'title' => $brief->rewardLedger->title,
                    'reward_code' => $brief->rewardLedger->reward_code,
                    'reward_type' => $brief->rewardLedger->reward_type,
                    'target_product' => $brief->rewardLedger->target_product,
                    'value' => (float) $brief->rewardLedger->value,
                    'description' => $brief->rewardLedger->spinReward?->description,
                    'terms_text' => $brief->rewardLedger->terms,
                    'how_to_use' => $brief->rewardLedger->how_to_use,
                    'expires_at' => $brief->rewardLedger->expires_at?->toIso8601String(),
                    'required_order_quantity' => $this->rewardOrderQuantity($brief->rewardLedger),
                ] : null,
                'linked_order' => $linkedOrder ? [
                    'id' => $linkedOrder->id,
                    'order_number' => $linkedOrder->order_number,
                    'status' => $linkedOrder->status->value ?? (string) $linkedOrder->status,
                    'payment_status' => $linkedOrder->payment_status->value ?? (string) $linkedOrder->payment_status,
                    'payment_url' => $reviewLink
                        ? rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'https://www.erryimprints.com.au')), '/') . '/orders/review/' . $reviewLink->token
                        : null,
                ] : null,
            ],
        ]);
    }

    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $brief = $this->briefsVisibleTo($request)->findOrFail($id);

        $validated =
            $request->validate([
                'status' => [
                    'sometimes',
                    'in:draft,new,reviewed,needs_info,in_progress,proof_sent,revision,completed,cancelled',
                ],

                'is_active' => [
                    'sometimes',
                    'boolean',
                ],

                'expires_at' => [
                    'sometimes',
                    'nullable',
                    'date',
                ],
            ]);

        if (($validated['status'] ?? null) === 'completed' && $brief->status !== 'approved') {
            return response()->json(['success' => false, 'message' => 'The customer must approve the design before production completion.'], 422);
        }

        $brief->update($validated);

        return response()->json([
            'success' => true,
            'message' =>
                'Client brief updated.',
            'data' => $brief->fresh()->only([
                'id','uuid','status','is_active','expires_at','submitted_at','updated_at',
            ]),
        ]);
    }

    public function setDesignFee(Request $request, int $id, OrderNotificationService $notifications): JsonResponse
    {
        $data = $request->validate(['design_fee' => ['required', 'numeric', 'min:0', 'max:10000']]);
        $brief = $this->briefsVisibleTo($request)->findOrFail($id);
        if ($brief->order()->exists()) return response()->json(['success' => false, 'message' => 'The linked order already exists; update the design service line on the order instead.'], 422);
        if ((float) $data['design_fee'] === (float) $brief->design_fee) return response()->json(['success' => true, 'message' => 'Design fee is unchanged.']);
        $brief->update(['design_fee' => $data['design_fee'], 'design_fee_accepted_at' => null]);
        $amount = number_format((float) $data['design_fee'], 2);
        $brief->messages()->create(['author' => 'employee', 'message' => (float) $data['design_fee'] > 0 ? "Design service fee: AUD \${$amount}. Please review and accept it before we proceed." : 'The design service fee has been removed.']);
        if ((float) $brief->design_fee > 0) $notifications->sendClientBriefCustomerUpdate($brief->fresh(), 'A design service fee is ready for your review. Please open your design query link to accept it.');
        return response()->json(['success' => true, 'message' => 'Design fee updated and customer notified.']);
    }

    /** Create the quoted order and secure payment link before artwork production starts. */
    public function createPaymentOrder(
        Request $request,
        int $id,
        ManualOrderService $orders,
        OrderNotificationService $notifications
    ): JsonResponse {
        $brief = $this->briefsVisibleTo($request)->with('rewardLedger')->findOrFail($id);
        $data = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10000000'],
            'unit_price_ex_gst' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'delivery_address' => ['nullable', 'string', 'max:2000'],
        ]);

        $existingOrder = $brief->order()->with('activeReviewLink')->first();
        if ($existingOrder) {
            if (($existingOrder->payment_status->value ?? (string) $existingOrder->payment_status) !== 'paid'
                && ($existingOrder->status->value ?? (string) $existingOrder->status) === 'draft') {
                $existingOrder->update(['status' => 'pending_payment']);
            }
            $activeLink = $existingOrder->activeReviewLink ?: $orders->generateReviewLink($existingOrder, $request->user());
            return response()->json([
                'success' => true,
                'message' => 'A payment order already exists for this design query.',
                'data' => [
                    'order_id' => $existingOrder->id,
                    'order_number' => $existingOrder->order_number,
                    'payment_status' => $existingOrder->payment_status->value ?? (string) $existingOrder->payment_status,
                    'payment_url' => $activeLink ? rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.erryimprints.com.au')), '/') . '/orders/review/' . $activeLink->token : null,
                ],
            ]);
        }

        $product = Product::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($data['product_name']))])
            ->where('is_active', true)
            ->first();
        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Select an active catalog product for this order.'], 422);
        }

        $reward = $brief->rewardLedger;
        $rewardQuantity = $reward ? $this->rewardOrderQuantity($reward) : null;
        $quantity = $rewardQuantity ?? ($brief->quantity ?: (int) $data['quantity']);
        if ($rewardQuantity && (int) $data['quantity'] !== $rewardQuantity) {
            return response()->json(['success' => false, 'message' => 'This reward requires an order quantity of ' . number_format($rewardQuantity) . '.'], 422);
        }
        if ($brief->quantity && (int) $brief->quantity !== (int) $data['quantity']) {
            return response()->json(['success' => false, 'message' => 'The order quantity must match the submitted design query.'], 422);
        }

        $productName = $reward?->target_product ?: ($brief->product ?: $product->name);
        $item = [
            'product_id' => $product->id,
            'product_name' => $productName,
            'quantity' => $quantity,
            'unit_price_ex_gst' => (float) $data['unit_price_ex_gst'],
            'specifications' => trim(implode("\n", array_filter([
                $brief->description,
                $brief->additional_notes,
                $brief->width && $brief->height ? "Size: {$brief->width} × {$brief->height} {$brief->unit}" : null,
                'Reward: ' . ($reward?->title ?? 'None'),
                'Reward code: ' . ($reward?->reward_code ?? 'None'),
                $reward?->spinReward?->description ? 'Reward description: ' . $reward->spinReward->description : null,
                $reward?->terms ? 'Reward terms: ' . $reward->terms : null,
                $reward?->how_to_use ? 'Reward instructions: ' . $reward->how_to_use : null,
            ]))),
            'options' => ['client_brief_id' => $brief->id, 'reward_code' => $reward?->reward_code],
        ];

        try {
            $deliveryAddress = $data['delivery_address'] ?? $brief->delivery_address ?: 'To be confirmed';
            $orderData = [
                'client_brief_id' => $brief->id,
                'customer_name' => $brief->client_name,
                'customer_email' => $brief->email,
                'customer_phone' => $brief->phone,
                'company_name' => $brief->company_name,
                'delivery_method' => $brief->fulfilment === 'pickup' ? 'Pickup' : 'Standard delivery (Free)',
                'delivery_address' => $deliveryAddress,
                'customer_notes' => 'Order created from design query DQ-' . str_pad((string) $brief->id, 4, '0', STR_PAD_LEFT) . '. Artwork is supplied after payment and requires customer approval.',
                'internal_notes' => 'Reward-linked design query #' . $brief->id . '. Collect payment before uploading artwork.',
                'shipping_fee' => $data['shipping_fee'] ?? null,
                'items' => [$item],
            ];
            $order = $orders->createManualOrder($request->user(), $orderData);

            if ($reward) {
                $order->update([
                    'applied_reward_code' => $reward->reward_code,
                    'applied_reward_title' => $reward->title,
                    'applied_reward_type' => $reward->reward_type,
                ]);
                $order = $orders->updateManualOrder($order, $request->user(), $orderData);
            }

            $order->update(['status' => 'pending_payment']);

            $link = $orders->generateReviewLink($order, $request->user());
            $paymentUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://www.erryimprints.com.au')), '/') . '/orders/review/' . $link->token;
            $brief->messages()->create([
                'author' => 'employee',
                'message' => 'Order ' . $order->order_number . ' is ready. Please complete payment first. Our team will then upload the artwork here for your approval. Payment link: ' . $paymentUrl,
            ]);
            $notifications->sendClientBriefCustomerUpdate(
                $brief->fresh(),
                'Order ' . $order->order_number . ' is ready for payment. Please use this secure link: ' . $paymentUrl
            );

            return response()->json([
                'success' => true,
                'message' => 'Payment order created and sent to the customer.',
                'data' => [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'payment_status' => $order->payment_status->value ?? (string) $order->payment_status,
                    'payment_url' => $paymentUrl,
                ],
            ], 201);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Could not create the payment order.',
            ], 422);
        }
    }

    private function rewardOrderQuantity(CustomerRewardLedger $reward): ?int
    {
        $text = implode(' ', [$reward->title, $reward->terms, $reward->how_to_use]);
        $patterns = [
            '/(?:order|purchase)\s+(?:(?:of|for)\s+)?(?:at least\s+)?(\d[\d,]*)/i',
            '/minimum\s+(?:order\s+)?(?:quantity|qty)\s*(?:of\s*)?(\d[\d,]*)/i',
            '/buy\s+(?:at least\s+)?(\d[\d,]*)/i',
        ];
        $matches = [];
        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $text, $found)) {
                foreach ($found[1] as $value) $matches[] = (int) str_replace(',', '', $value);
            }
        }
        $quantity = end($matches);
        return $quantity !== false && $quantity > 0 && $quantity <= 10000000 ? $quantity : null;
    }

    public function uploadDesign(Request $request, int $id, OrderNotificationService $notifications): JsonResponse
    {
        $brief = $this->briefsVisibleTo($request)->findOrFail($id);
        $linkedOrder = $brief->order;
        if (!$linkedOrder || ($linkedOrder->payment_status->value ?? (string) $linkedOrder->payment_status) !== 'paid') {
            return response()->json(['success' => false, 'message' => 'Create the payment order and wait for verified customer payment before uploading artwork.'], 409);
        }
        $data = $request->validate([
            'file' => ['required','file','max:51200','mimes:pdf,png,jpg,jpeg,webp,svg,ai,eps,psd,tif,tiff'],
            'message' => ['nullable','string','max:5000'],
        ]);
        $file = $data['file'];
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->storeAs('client-briefs/'.$brief->uuid, \Illuminate\Support\Str::uuid().($extension ? '.'.$extension : ''), 'public');
        if (!$path) return response()->json(['success' => false, 'message' => 'Could not store design file.'], 500);
        $brief->files()->create([
            'file_type' => 'design', 'original_name' => $file->getClientOriginalName(),
            'file_path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(),
        ]);
        if (!empty($data['message'])) $brief->messages()->create(['author' => 'employee', 'message' => $data['message']]);
        $brief->update(['status' => 'proof_sent']);
        $notifications->sendClientBriefCustomerUpdate(
            $brief->fresh(),
            $data['message'] ?? 'A new design preview is ready for your review.',
            true
        );
        return response()->json(['success' => true, 'message' => 'Design uploaded for customer review.']);
    }

    public function message(Request $request, int $id, OrderNotificationService $notifications): JsonResponse
    {
        $brief = $this->briefsVisibleTo($request)->findOrFail($id);
        $data = $request->validate([
            'message' => ['nullable','string','max:5000','required_without:image'],
            'image' => ['nullable','image','max:10240','required_without:message'],
        ]);
        $image = $request->file('image');
        $path = $image?->store('client-briefs/'.$brief->uuid.'/chat', 'public');
        if ($image && !$path) return response()->json(['success' => false, 'message' => 'Could not store the chat image.'], 500);
        $message = trim((string) ($data['message'] ?? ''));
        $brief->messages()->create([
            'author' => 'employee', 'message' => $message,
            'attachment_path' => $path,
            'attachment_name' => $image?->getClientOriginalName(),
            'attachment_mime_type' => $image?->getMimeType(),
        ]);
        $notifications->sendClientBriefCustomerUpdate($brief, $message ?: 'The design team sent an image.');
        return response()->json(['success' => true]);
    }

    private function submittedQueriesOnly(Request $request): bool
    {
        $user = $request->user();
        return $user && !$user->isSuperAdmin() && $user->hasPermission('design_queries_submitted_only');
    }

    private function briefsVisibleTo(Request $request)
    {
        $query = ClientBrief::query();
        if ($this->submittedQueriesOnly($request)) {
            $query->whereNotNull('submitted_at');
        }
        return $query;
    }
}
