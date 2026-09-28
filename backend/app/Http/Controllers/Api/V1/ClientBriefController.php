<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClientBrief;
use App\Models\ClientBriefFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ClientBriefController extends Controller
{
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

        return response()->json([
            'success' => true,

            'data' => [
                'uuid' => $brief->uuid,

                'client_name' =>
                    $brief->client_name,

                'company_name' =>
                    $brief->company_name,

                'email' =>
                    $brief->email,

                'status' =>
                    $brief->status,

                'submitted' =>
                    !is_null(
                        $brief->submitted_at
                    ),

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
                'nullable',
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
}