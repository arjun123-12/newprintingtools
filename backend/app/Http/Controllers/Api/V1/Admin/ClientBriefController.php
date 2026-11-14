<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientBrief;
use App\Services\Notification\OrderNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientBriefController extends Controller
{
    public function index(
        Request $request
    ): JsonResponse {
        $briefs = ClientBrief::query()
            ->withCount('files')
            ->select(['id','uuid','token','request_type','product','quantity','status','is_active','expires_at','submitted_at','created_at','updated_at'])
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
        int $id
    ): JsonResponse {
        $brief =
            ClientBrief::query()
                ->with(['files', 'messages', 'rewardLedger.spinReward'])
                ->findOrFail($id);

        $payload = $brief->only([
            'id','uuid','request_type','reorder_reference','project_name','product','quantity',
            'width','height','unit','print_sides','colours','description',
            'additional_notes','requested_date','status','is_active','expires_at','submitted_at',
            'created_at','updated_at','design_fee','design_fee_accepted_at',
        ]);

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
                ] : null,
                'linked_order' => $brief->order()->first(['id', 'order_number', 'status', 'payment_status']),
            ],
        ]);
    }

    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $brief =
            ClientBrief::findOrFail(
                $id
            );

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
        $brief = ClientBrief::findOrFail($id);
        if ($brief->order()->exists()) return response()->json(['success' => false, 'message' => 'The linked order already exists; update the design service line on the order instead.'], 422);
        if ((float) $data['design_fee'] === (float) $brief->design_fee) return response()->json(['success' => true, 'message' => 'Design fee is unchanged.']);
        $brief->update(['design_fee' => $data['design_fee'], 'design_fee_accepted_at' => null]);
        $amount = number_format((float) $data['design_fee'], 2);
        $brief->messages()->create(['author' => 'employee', 'message' => (float) $data['design_fee'] > 0 ? "Design service fee: AUD \${$amount}. Please review and accept it before we proceed." : 'The design service fee has been removed.']);
        if ((float) $brief->design_fee > 0) $notifications->sendClientBriefCustomerUpdate($brief->fresh(), 'A design service fee is ready for your review. Please open your design query link to accept it.');
        return response()->json(['success' => true, 'message' => 'Design fee updated and customer notified.']);
    }

    public function uploadDesign(Request $request, int $id, OrderNotificationService $notifications): JsonResponse
    {
        $brief = ClientBrief::findOrFail($id);
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
        $brief = ClientBrief::findOrFail($id);
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
}
