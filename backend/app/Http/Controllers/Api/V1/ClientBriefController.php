<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClientBrief;
use App\Models\ClientBriefFile;
use App\Models\Artwork;
use App\Models\ArtworkVersion;
use App\Models\OrderActivity;
use App\Models\Product;
use App\Models\CustomerRewardLedger;
use App\Services\Rewards\SpinRewardService;
use App\Services\Order\ManualOrderService;
use App\Services\Notification\OrderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ClientBriefController extends Controller
{
    /** Create or reuse a design query linked to the signed-in customer's claimed spin reward. */
    public function startFromReward(Request $request, SpinRewardService $rewards): JsonResponse
    {
        $data = $request->validate(['claim_token' => ['required', 'string', 'max:120']]);
        try {
            $ledger = $rewards->claimReward($request->user(), $data['claim_token']);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        }
        $ledger->load('spinReward');
        $brief = ClientBrief::where('spin_reward_ledger_id', $ledger->id)->first();
        if (!$brief) {
            $user = $request->user();
            $reward = $ledger->spinReward;
            $product = $ledger->target_product ?: $reward?->target_product;
            if (!$product && $ledger->reward_type === 'free_product') {
                $product = preg_replace('/^free\s+/i', '', $ledger->title) ?: $ledger->title;
            }
            $brief = ClientBrief::create([
                'uuid' => (string) Str::uuid(), 'token' => Str::random(48), 'status' => 'draft',
                'is_active' => true, 'expires_at' => now()->addDays(30), 'user_id' => $user->id,
                'spin_reward_ledger_id' => $ledger->id, 'client_name' => $user->name,
                'company_name' => $user->company_name, 'email' => $user->email, 'phone' => $user->phone,
                'product' => $product, 'quantity' => $ledger->reward_type === 'free_product' ? 1 : null,
                'request_type' => 'design', 'description' => 'Spin reward: ' . $ledger->title . ' (' . $ledger->reward_code . ')',
            ]);
        }
        return response()->json(['success' => true, 'data' => ['token' => $brief->token, 'product' => $brief->product]], 201);
    }

    /** Create a short-lived secure brief link for a customer starting from the website. */
    public function start(): JsonResponse
    {
        $brief = ClientBrief::create([
            'uuid' => (string) Str::uuid(),
            'token' => Str::random(48),
            'status' => 'draft',
            'is_active' => true,
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json([
            'success' => true,
            'data' => ['token' => $brief->token],
        ], 201);
    }

    /**
     * Open private client brief.
     */
    public function show(string $token): JsonResponse
    {
        $brief = ClientBrief::query()
            ->where('token', $token)
            ->where('is_active', true)
            ->first();

        if (!$brief) {
            return response()->json([
                'success' => false,
                'message' => 'This client brief link is invalid.',
            ], 404);
        }

        if (
            $brief->expires_at &&
            $brief->expires_at->isPast()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'This client brief link has expired.',
            ], 410);
        }

        $submitted = !is_null($brief->submitted_at);
        return response()->json([
            'success' => true,

            'data' => [
                'uuid' => $brief->uuid,

                'status' =>
                    $brief->status,

                'submitted' => $submitted,
                'product' => $brief->product,
                'client_name' => $brief->client_name,
                'company_name' => $brief->company_name,
                'email' => $brief->email,
                'phone' => $brief->phone,
                'design_fee' => (float) $brief->design_fee,
                'design_fee_accepted' => !is_null($brief->design_fee_accepted_at),
                'spin_reward' => $brief->spin_reward_ledger_id ? [
                    'title' => $brief->rewardLedger?->title,
                    'reward_code' => $brief->rewardLedger?->reward_code,
                    'reward_type' => $brief->rewardLedger?->reward_type,
                    'target_product' => $brief->rewardLedger?->target_product,
                    'value' => (float) ($brief->rewardLedger?->value ?? 0),
                ] : null,
                'quantity' => $brief->quantity,
                'width' => $submitted ? $brief->width : null,
                'height' => $submitted ? $brief->height : null,
                'unit' => $submitted ? $brief->unit : null,
                'print_sides' => $submitted ? $brief->print_sides : null,
                'colours' => $submitted ? $brief->colours : null,
                'description' => $submitted ? $brief->description : null,
                'additional_notes' => $submitted ? $brief->additional_notes : null,
                'files' => $submitted ? $brief->files()->where('file_type', 'design')->get()->map(fn ($file) => [
                    'id' => $file->id, 'name' => $file->original_name,
                    'mime_type' => $file->mime_type, 'url' => $file->file_url,
                ]) : [],
                'messages' => $submitted ? $brief->messages()->orderBy('created_at')->get(['id', 'author', 'message', 'attachment_path', 'attachment_name', 'attachment_mime_type', 'created_at']) : [],
                'approved' => $brief->status === 'approved' || $brief->status === 'completed',
                'order_created' => $brief->order()->exists(),

                'expires_at' =>
                    $brief->expires_at
                        ?->toISOString(),
            ],
        ]);
    }

    /**
     * Submit client brief.
     */
    public function submit(
        Request $request,
        string $token
    ): JsonResponse {
        $brief = ClientBrief::query()
            ->where('token', $token)
            ->where('is_active', true)
            ->first();

        if (!$brief) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This client brief link is invalid.',
            ], 404);
        }

        if (
            $brief->expires_at &&
            $brief->expires_at->isPast()
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This client brief link has expired.',
            ], 410);
        }

        if ($brief->submitted_at) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This client brief has already been submitted.',
            ], 409);
        }

        $validated = $request->validate([
            'request_type' => [
                'required',
                'in:ready,design,reorder',
            ],

            'contact' => [
                'required',
                'string',
                'max:150',
            ],

            'company' => [
                'required',
                'string',
                'max:150',
            ],

            'email' => [
                'required',
                'email',
                'max:255',
            ],

            'phone' => [
                'required',
                'string',
                'max:50',
            ],

            'reorder_reference' => [
                'nullable',
                'string',
                'max:100',
            ],

            'product' => [
                'required',
                'string',
                'max:150',
            ],

            'quantity' => [
                'required',
                'integer',
                'min:1',
                'max:10000000',
            ],

            'requested_date' => [
                'nullable',
                'date',
            ],

            'width' => [
                'nullable',
                'numeric',
                'min:0.01',
            ],

            'height' => [
                'nullable',
                'numeric',
                'min:0.01',
            ],

            'unit' => [
                'required',
                'in:mm,cm,m',
            ],

            'print_sides' => [
                'required',
                'in:front,back,both',
            ],

            'fulfilment' => [
                'required',
                'in:pickup,delivery,unsure',
            ],

            'address' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'colours' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'specs' => [
                'required',
                'string',
                'max:10000',
            ],

            'additional_notes' => [
                'nullable',
                'string',
                'max:10000',
            ],

            'files' => [
                'nullable',
                'array',
                'max:10',
            ],

            'files.*' => [
                'file',
                'max:51200', // 50MB
                'mimes:pdf,png,jpg,jpeg,webp,svg,ai,eps,psd,tif,tiff',
            ],
        ]);

        if (
            $validated['request_type'] ===
                'reorder' &&
            empty(
                $validated[
                    'reorder_reference'
                ]
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Previous job reference is required for a reorder.',
            ], 422);
        }

        if (
            ($validated['width'] ?? null) &&
            !($validated['height'] ?? null)
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Please provide both width and height.',
            ], 422);
        }

        if (
            ($validated['height'] ?? null) &&
            !($validated['width'] ?? null)
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Please provide both width and height.',
            ], 422);
        }

        if (
            $validated['fulfilment'] ===
                'delivery' &&
            empty($validated['address'])
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Delivery address is required.',
            ], 422);
        }

        DB::beginTransaction();

        $storedFiles = [];

        try {
            $brief->update([
                'client_name' =>
                    $validated['contact'],

                'company_name' =>
                    $validated['company'] ??
                    null,

                'email' =>
                    strtolower(
                        $validated['email']
                    ),

                'phone' =>
                    $validated['phone'],

                'request_type' =>
                    $validated[
                        'request_type'
                    ],

                'reorder_reference' =>
                    $validated[
                        'reorder_reference'
                    ] ?? null,

                'product' =>
                    $validated['product'],

                'quantity' =>
                    $validated['quantity'],

                'requested_date' =>
                    $validated[
                        'requested_date'
                    ] ?? null,

                'width' =>
                    $validated['width'] ??
                    null,

                'height' =>
                    $validated['height'] ??
                    null,

                'unit' =>
                    $validated['unit'],

                'print_sides' =>
                    $validated[
                        'print_sides'
                    ],

                'fulfilment' =>
                    $validated[
                        'fulfilment'
                    ],

                'delivery_address' =>
                    $validated['address'] ??
                    null,

                'colours' =>
                    $validated['colours'] ??
                    null,

                'description' =>
                    $validated['specs'],

                'additional_notes' =>
                    $validated[
                        'additional_notes'
                    ] ?? null,

                'status' => 'new',

                'submitted_at' => now(),
                'expires_at' => now()->addDays(90),
            ]);

            foreach (
                $request->file(
                    'files',
                    []
                ) as $file
            ) {
                $extension =
                    strtolower(
                        $file
                            ->getClientOriginalExtension()
                    );

                $filename =
                    Str::uuid() .
                    (
                        $extension
                            ? '.' .
                                $extension
                            : ''
                    );

                $path =
                    $file->storeAs(
                        'client-briefs/' .
                            $brief->uuid,
                        $filename,
                        'public'
                    );

                if (!$path) {
                    throw new \RuntimeException(
                        'Failed to store uploaded file.'
                    );
                }

                $storedFiles[] = $path;

                ClientBriefFile::create([
                    'client_brief_id' =>
                        $brief->id,

                    'file_type' =>
                        'attachment',

                    'original_name' =>
                        $file
                            ->getClientOriginalName(),

                    'file_path' =>
                        $path,

                    'mime_type' =>
                        $file
                            ->getMimeType(),

                    'size_bytes' =>
                        $file->getSize(),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,

                'message' =>
                    'Client brief submitted successfully.',

                'data' => [
                    'id' =>
                        $brief->id,

                    'uuid' =>
                        $brief->uuid,

                    'reference' =>
                        'BRIEF-' .
                        str_pad(
                            (string)
                                $brief->id,
                            6,
                            '0',
                            STR_PAD_LEFT
                        ),

                    'status' =>
                        $brief->status,

                    'submitted_at' =>
                        $brief
                            ->submitted_at
                            ?->toISOString(),
                ],
            ], 201);
        } catch (Throwable $exception) {
            DB::rollBack();

            foreach (
                $storedFiles as $path
            ) {
                Storage::disk('public')
                    ->delete($path);
            }

            report($exception);

            return response()->json([
                'success' => false,

                'message' =>
                    'Could not submit the client brief.',

                'error' =>
                    config('app.debug')
                        ? $exception
                            ->getMessage()
                        : null,
            ], 500);
        }
    }

    public function message(Request $request, string $token, OrderNotificationService $notifications): JsonResponse
    {
        $brief = $this->findSubmitted($token);
        if ($brief instanceof JsonResponse) return $brief;
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:5000', 'required_without:image'],
            'image' => ['nullable', 'image', 'max:10240', 'required_without:message'],
        ]);
        $image = $request->file('image');
        $path = $image?->store('client-briefs/' . $brief->uuid . '/chat', 'public');
        if ($image && !$path) return response()->json(['success' => false, 'message' => 'Could not store the chat image.'], 500);
        $message = trim((string) ($data['message'] ?? ''));
        $brief->messages()->create([
            'author' => 'customer', 'message' => $message,
            'attachment_path' => $path,
            'attachment_name' => $image?->getClientOriginalName(),
            'attachment_mime_type' => $image?->getMimeType(),
        ]);
        if (in_array($brief->status, ['proof_sent', 'in_progress'], true)) $brief->update(['status' => 'revision']);
        $notifications->sendClientBriefMessageAlert($brief->fresh(), $message ?: 'Customer sent an image.');
        return response()->json(['success' => true]);
    }

    public function acceptDesignFee(string $token, OrderNotificationService $notifications): JsonResponse
    {
        $brief = $this->findSubmitted($token);
        if ($brief instanceof JsonResponse) return $brief;
        if ((float) $brief->design_fee <= 0) return response()->json(['success' => false, 'message' => 'No design fee is awaiting acceptance.'], 422);
        $brief->update(['design_fee_accepted_at' => now()]);
        $brief->messages()->create(['author' => 'customer', 'message' => 'Customer accepted the design service fee of AUD $' . number_format((float) $brief->design_fee, 2) . '.']);
        $notifications->sendClientBriefMessageAlert($brief->fresh(), 'Customer accepted the design service fee.');
        return response()->json(['success' => true]);
    }

    public function approve(string $token, ManualOrderService $manualOrderService): JsonResponse
    {
        $brief = $this->findSubmitted($token);
        if ($brief instanceof JsonResponse) return $brief;
        if (!$brief->files()->where('file_type', 'design')->exists()) return response()->json(['success' => false, 'message' => 'There is no design to approve yet.'], 422);
        if ((float) $brief->design_fee > 0 && !$brief->design_fee_accepted_at) return response()->json(['success' => false, 'message' => 'Please accept the design service fee before approving the design.'], 422);

        $order = $brief->order;
        $designFiles = $brief->files()->where('file_type', 'design')->get();
        if (!$order) {
            $product = Product::query()
                ->whereRaw('LOWER(name) = ?', [strtolower(trim((string) $brief->product))])
                ->first()
                ?? Product::query()->where('is_active', true)->where('name', 'like', '%custom%')->first()
                ?? Product::query()->where('is_active', true)->first();

            if (!$product) {
                return response()->json(['success' => false, 'message' => 'No active product is available to create the order. Please contact the print team.'], 422);
            }

            $previewLinks = $designFiles->map(fn ($file) => $file->file_url)->implode("\n");
            $specifications = trim(implode("\n", array_filter([
                'Requested product: ' . $brief->product,
                $brief->width && $brief->height ? "Size: {$brief->width} × {$brief->height} {$brief->unit}" : null,
                'Print sides: ' . $brief->print_sides,
                $brief->colours ? 'Colours: ' . $brief->colours : null,
                $brief->description,
                $brief->additional_notes,
                'Customer approved design preview(s):' . "\n" . $previewLinks,
            ])));

            $items = [[
                'product_id' => $product->id,
                'product_name' => $brief->product ?: $product->name,
                'quantity' => max(1, (int) ($brief->quantity ?: 1)),
                'price' => 0,
                'specifications' => $specifications,
                'options' => ['specifications' => $specifications, 'approved_design_urls' => $designFiles->map(fn ($file) => $file->file_url)->values()->all()],
            ]];
            if ((float) $brief->design_fee > 0) {
                $items[] = [
                    // Keep the design service as a separate non-catalog line.
                    // Assigning the print product ID makes ManualOrderService
                    // replace this label with the product name, which can
                    // incorrectly include the service fee in a product reward.
                    'product_id' => null,
                    'product_name' => 'Graphic design service',
                    'quantity' => 1,
                    'price' => (float) $brief->design_fee,
                    'specifications' => 'Customer accepted design service fee on ' . $brief->design_fee_accepted_at?->format('Y-m-d H:i'),
                    'options' => ['design_service_fee' => true, 'non_production' => true, 'client_brief_id' => $brief->id],
                ];
            }
            $order = $manualOrderService->createManualOrder(null, [
                'client_brief_id' => $brief->id,
                'customer_name' => $brief->client_name,
                'customer_email' => $brief->email,
                'customer_phone' => $brief->phone,
                'company_name' => $brief->company_name,
                'delivery_method' => $brief->fulfilment === 'pickup' ? 'Pickup' : 'Standard delivery (Free)',
                'delivery_address' => $brief->delivery_address ?: 'To be confirmed',
                'customer_notes' => 'Design request DQ-' . str_pad((string) $brief->id, 4, '0', STR_PAD_LEFT) . ' approved. Print price is not set; confirm the quote before sending a payment link.',
                'internal_notes' => 'Created from approved design query #' . $brief->id . '. Set the correct price before sending any payment request.',
                'items' => $items,
            ]);

            if ($brief->spin_reward_ledger_id) {
                $reward = CustomerRewardLedger::find($brief->spin_reward_ledger_id);
                if ($reward) $order->update([
                    'applied_reward_code' => $reward->reward_code,
                    'applied_reward_title' => $reward->title,
                    'applied_reward_type' => $reward->reward_type,
                ]);
            }

        }

        if (!$order->artworks()->exists()) {
            $lineItem = $order->items()->firstOrFail();
            $firstDesign = $designFiles->first();
            $artwork = Artwork::create([
                'user_id' => $order->user_id,
                'product_id' => $lineItem->product_id,
                'name' => 'Customer-approved design for ' . $order->order_number,
                'source_type' => 'upload',
                'file_name' => $firstDesign->original_name,
                'file_size_bytes' => $firstDesign->size_bytes,
                'mime_type' => $firstDesign->mime_type ?: 'application/octet-stream',
                'storage_disk' => 'public',
                'storage_path' => $firstDesign->file_path,
                'public_url' => $firstDesign->file_url,
                'thumbnail_url' => $firstDesign->file_url,
                'proof_pdf_url' => $firstDesign->file_url,
                'status' => 'customer_approved',
                'proof_status' => 'ready',
                'review_status' => 'approved',
                'approved_by' => $order->user_id,
                'approved_at' => now(),
                'current_version' => 1,
                'order_id' => $order->id,
            ]);
            $proofFiles = $designFiles->values()->map(fn ($file, $index) => [
                'label' => $index === 0 ? 'Front' : 'Design ' . ($index + 1),
                'file_name' => $file->original_name,
                'storage_path' => $file->file_path,
                'url' => $file->file_url,
                'file_size_bytes' => $file->size_bytes,
                'mime_type' => $file->mime_type,
            ])->all();
            ArtworkVersion::create([
                'artwork_id' => $artwork->id,
                'version_number' => 1,
                'file_name' => $firstDesign->original_name,
                'file_size_bytes' => $firstDesign->size_bytes,
                'mime_type' => $firstDesign->mime_type ?: 'application/octet-stream',
                'storage_disk' => 'public',
                'storage_path' => $firstDesign->file_path,
                'thumbnail_url' => $firstDesign->file_url,
                'proof_pdf_url' => $firstDesign->file_url,
                'proof_files' => $proofFiles,
                'is_approved' => true,
                'change_summary' => 'Customer-approved final design transferred from design query.',
            ]);
            $lineItem->update(['artwork_id' => $artwork->id]);
            OrderActivity::record(
                $order->id,
                'proof_approved',
                'Customer-approved design transferred from design query #' . $brief->id . '.',
                'customer',
                null,
                ['client_brief_id' => $brief->id, 'approved_version' => 1]
            );
        }

        $order->update([
            'current_proof_version' => 1,
            'approved_proof_version' => 1,
            'proof_approved_at' => $order->proof_approved_at ?: now(),
            'proof_approved_by' => $order->proof_approved_by ?: ($brief->client_name ?: 'Customer'),
            'status' => 'pending_payment',
        ]);
        if (!$order->activeReviewLink) $manualOrderService->generateReviewLink($order, null);

        $brief->update(['status' => 'approved']);
        return response()->json([
            'success' => true,
            'message' => 'Design approved and a draft order is ready for pricing.',
            'data' => ['order_id' => $order->id, 'order_number' => $order->order_number],
        ]);
    }

    private function findSubmitted(string $token): ClientBrief|JsonResponse
    {
        $brief = ClientBrief::where('token', $token)->where('is_active', true)->first();
        if (!$brief || ($brief->expires_at && $brief->expires_at->isPast())) return response()->json(['success' => false, 'message' => 'This design link is invalid or expired.'], 404);
        if (!$brief->submitted_at) return response()->json(['success' => false, 'message' => 'Design request has not been submitted.'], 409);
        return $brief;
    }
}
