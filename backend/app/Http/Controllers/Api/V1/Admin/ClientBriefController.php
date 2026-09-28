<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientBrief;
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
            ->latest()
            ->paginate(
                $request->integer(
                    'per_page',
                    20
                )
            );

        return response()->json([
            'success' => true,
            'data' => $briefs,
        ]);
    }

    public function store(
        Request $request
    ): JsonResponse {
        $validated =
            $request->validate([
                'client_name' => [
                    'nullable',
                    'string',
                    'max:150',
                ],

                'company_name' => [
                    'nullable',
                    'string',
                    'max:150',
                ],

                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                ],

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

                'client_name' =>
                    $validated[
                        'client_name'
                    ] ?? null,

                'company_name' =>
                    $validated[
                        'company_name'
                    ] ?? null,

                'email' =>
                    isset(
                        $validated[
                            'email'
                        ]
                    )
                        ? strtolower(
                            $validated[
                                'email'
                            ]
                        )
                        : null,

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

                'client_name' =>
                    $brief->client_name,

                'email' =>
                    $brief->email,

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
                ->with('files')
                ->findOrFail($id);

        return response()->json([
            'success' => true,

            'data' => [
                ...$brief->toArray(),

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
                    'in:draft,new,reviewed,needs_info,in_progress,proof_sent,approved,completed,cancelled',
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

        $brief->update(
            $validated
        );

        return response()->json([
            'success' => true,
            'message' =>
                'Client brief updated.',
            'data' =>
                $brief->fresh(),
        ]);
    }
}