<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ArtworkStatus;
use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\ArtworkReview;
use App\Models\ArtworkVersion;
use App\Models\StaffAuditLog;
use App\Models\User;
use App\Services\Artwork\ArtworkValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminArtworkController extends Controller
{
    public function __construct(
        protected ArtworkValidationService $validationService
    ) {}

    /**
     * Display a paginated, filterable queue of artwork submissions.
     * Enforces designer isolation and strips financial details for designers.
     */
    public function queue(Request $request): JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $query = Artwork::query()
            ->with([
                'product:id,name,slug,sku,featured_image_url,width_mm,height_mm',
                'user:id,name,email,company_name,phone',
                'assignedDesigner:id,name,email,role_preset',
                'approvedByUser:id,name,email',
                'order:id,order_number,status,payment_status,subtotal_ex_gst,gst_amount,total_inc_gst,created_at',
                'orderItems:id,artwork_id,order_id,product_id,product_name,quantity,unit_price_inc_gst,total_price_inc_gst,options_snapshot,production_status',
            ])
            ->latest('created_at');

        // 1. Designer isolation: Designers see ONLY submissions assigned to them
        if ($isDesigner) {
            $query->where('assigned_designer_id', $user->id);
        } else {
            // Admins can filter by assigned designer
            if ($request->filled('designer_id')) {
                $designerFilter = $request->input('designer_id');
                if ($designerFilter === 'unassigned') {
                    $query->whereNull('assigned_designer_id');
                } elseif ($designerFilter === 'me') {
                    $query->where('assigned_designer_id', $user->id);
                } elseif (is_numeric($designerFilter)) {
                    $query->where('assigned_designer_id', (int) $designerFilter);
                }
            }
        }

        // 2. Filter by Review Status
        if ($request->filled('review_status') && $request->input('review_status') !== 'all') {
            $query->where('review_status', $request->input('review_status'));
        }

        // 3. Filter by Preflight Status / Verdict
        if ($request->filled('preflight_status') && $request->input('preflight_status') !== 'all') {
            $query->where('status', $request->input('preflight_status'));
        }

        // 4. Global Search across order reference, product, customer name/email, and file name
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('file_name', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhereHas('order', function ($oq) use ($search) {
                        $oq->where('order_number', 'like', "%{$search}%");
                    })
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('sku', 'like', "%{$search}%");
                    })
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('company_name', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = $request->integer('per_page', 15);
        $artworks = $query->paginate($perPage);

        // Sanitize financial and admin-only notes for designers
        $artworks->getCollection()->transform(function (Artwork $artwork) use ($isDesigner) {
            return $this->sanitizeArtworkForUser($artwork, $isDesigner);
        });

        // Compute Queue Metric Counters
        $baseStatsQuery = Artwork::query();
        if ($isDesigner) {
            $baseStatsQuery->where('assigned_designer_id', $user->id);
        }

        $stats = [
            'total' => (clone $baseStatsQuery)->count(),
            'pending_review' => (clone $baseStatsQuery)->where('review_status', 'pending_review')->count(),
            'changes_requested' => (clone $baseStatsQuery)->where('review_status', 'changes_requested')->count(),
            'approved' => (clone $baseStatsQuery)->where('review_status', 'approved')->count(),
            'preflight_issues' => (clone $baseStatsQuery)->whereIn('status', [
                ArtworkStatus::PREFLIGHT_WARNING->value,
                ArtworkStatus::PREFLIGHT_FAILED->value,
            ])->count(),
            'unassigned' => $isDesigner ? 0 : Artwork::query()->whereNull('assigned_designer_id')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $artworks,
            'stats' => $stats,
            'is_designer_view' => $isDesigner,
        ]);
    }

    /**
     * Show detailed view of a single artwork submission with version and review histories.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $artwork = Artwork::with([
            'product',
            'user:id,name,email,company_name,phone',
            'assignedDesigner:id,name,email,role_preset',
            'approvedByUser:id,name,email',
            'order',
            'orderItems',
            'versions.uploader:id,name,email',
            'reviews.reviewer:id,name,email',
        ])->findOrFail($id);

        if ($isDesigner && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to access this artwork submission.',
            ], 403);
        }

        // Run live preflight inspection if not already inspected or if fresh
        $preflight = $this->validationService->inspectArtwork($artwork);

        $sanitized = $this->sanitizeArtworkForUser($artwork, $isDesigner);

        return response()->json([
            'success' => true,
            'data' => $sanitized,
            'live_preflight' => $preflight,
            'is_designer_view' => $isDesigner,
        ]);
    }

    /**
     * Securely download or stream the submitted artwork file.
     * Prevents direct unauthenticated URLs and enforces access control.
     */
    public function download(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $artwork = Artwork::findOrFail($id);

        if ($isDesigner && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to download this artwork file.',
            ], 403);
        }

        if ($artwork->source_type === 'designer') {
            // For online designer creations, export canvas JSON as a formatted file
            $fileName = ($artwork->name ?: 'design') . '.json';
            $content = json_encode($artwork->canvas_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

            return response()->streamDownload(function () use ($content) {
                echo $content;
            }, $fileName, [
                'Content-Type' => 'application/json',
            ]);
        }

        $disk = $artwork->storage_disk ?: 'public';
        $path = $artwork->storage_path;

        if (empty($path) || !Storage::disk($disk)->exists($path)) {
            // Check public path fallback
            if (!empty($path) && file_exists(public_path($path))) {
                return response()->download(public_path($path), $artwork->file_name ?: basename($path));
            }

            return response()->json([
                'success' => false,
                'message' => 'The requested artwork file was not found in storage.',
            ], 404);
        }

        $downloadName = $artwork->file_name ?: basename($path);
        return Storage::disk($disk)->download($path, $downloadName);
    }

    /**
     * Generate customer proof for an artwork submission.
     */
    public function generateProof(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $artwork = Artwork::findOrFail($id);

        if ($isDesigner && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        // Generate proof URL (uses existing thumbnail/file or watermarked path)
        $proofUrl = $artwork->proof_pdf_url ?: $artwork->thumbnail_url ?: $artwork->public_url;

        $artwork->update([
            'proof_status' => 'generated',
            'proof_generated_at' => now(),
            'proof_pdf_url' => $proofUrl,
        ]);

        // Record in review timeline
        ArtworkReview::create([
            'artwork_id' => $artwork->id,
            'version_number' => $artwork->current_version,
            'reviewer_id' => $user->id,
            'action' => 'proof_generated',
            'notes' => $request->input('notes', 'Customer proof generated and queued for review.'),
            'metadata' => [
                'proof_url' => $proofUrl,
                'generated_by' => $user->name,
            ],
        ]);

        // Record in staff audit log
        $this->logStaffAudit($user, $artwork, 'artwork_proof_generated', [
            'proof_url' => $proofUrl,
            'version' => $artwork->current_version,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Customer proof generated successfully.',
            'data' => $artwork->fresh(['reviews.reviewer']),
        ]);
    }

    /**
     * Approve the submitted artwork version for print production.
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $artwork = Artwork::findOrFail($id);

        if ($isDesigner && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        DB::transaction(function () use ($artwork, $user, $request) {
            $artwork->update([
                'review_status' => 'approved',
                'status' => ArtworkStatus::READY_FOR_PRODUCTION,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);

            // Mark current version as approved
            ArtworkVersion::where('artwork_id', $artwork->id)
                ->where('version_number', $artwork->current_version)
                ->update(['is_approved' => true]);

            // Update linked order items production status to prepress
            $artwork->orderItems()->update([
                'production_status' => 'prepress',
            ]);

            // Record in review timeline
            ArtworkReview::create([
                'artwork_id' => $artwork->id,
                'version_number' => $artwork->current_version,
                'reviewer_id' => $user->id,
                'action' => 'approved',
                'notes' => $request->input('notes', 'Artwork approved for print production.'),
            ]);

            // Record in staff audit log
            $this->logStaffAudit($user, $artwork, 'artwork_approved', [
                'notes' => $request->input('notes'),
                'version' => $artwork->current_version,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Artwork approved for print production.',
            'data' => $artwork->fresh(['reviews.reviewer', 'versions']),
        ]);
    }

    /**
     * Request changes from customer with detailed review notes.
     */
    public function requestChanges(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $isDesigner = $user->isRestrictedDesigner();

        $artwork = Artwork::findOrFail($id);

        if ($isDesigner && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        $validated = $request->validate([
            'notes' => 'required|string|min:5|max:5000',
        ]);

        DB::transaction(function () use ($artwork, $user, $validated) {
            $artwork->update([
                'review_status' => 'changes_requested',
                'status' => ArtworkStatus::REJECTED,
                'admin_notes' => $validated['notes'],
            ]);

            // Record in review timeline
            ArtworkReview::create([
                'artwork_id' => $artwork->id,
                'version_number' => $artwork->current_version,
                'reviewer_id' => $user->id,
                'action' => 'changes_requested',
                'notes' => $validated['notes'],
            ]);

            // Record in staff audit log
            $this->logStaffAudit($user, $artwork, 'artwork_changes_requested', [
                'reason' => $validated['notes'],
                'version' => $artwork->current_version,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Changes requested. Review note recorded for customer notification.',
            'data' => $artwork->fresh(['reviews.reviewer']),
        ]);
    }

    /**
     * Assign or reassign a designer to an artwork submission.
     * Restricted to Admins & Super Admins.
     */
    public function assignDesigner(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if ($user->isRestrictedDesigner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only administrators can assign or reassign designers.',
            ], 403);
        }

        $validated = $request->validate([
            'designer_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $artwork = Artwork::findOrFail($id);
        $newDesignerId = $validated['designer_id'] ?? null;
        $oldDesignerId = $artwork->assigned_designer_id;

        $designer = $newDesignerId ? User::find($newDesignerId) : null;

        $artwork->update([
            'assigned_designer_id' => $newDesignerId,
        ]);

        // Record in review timeline
        ArtworkReview::create([
            'artwork_id' => $artwork->id,
            'version_number' => $artwork->current_version,
            'reviewer_id' => $user->id,
            'action' => 'designer_assigned',
            'notes' => $designer
                ? "Assigned to designer {$designer->name} ({$designer->email})."
                : 'Artwork submission unassigned from designer.',
            'metadata' => [
                'assigned_to_id' => $newDesignerId,
                'assigned_to_name' => $designer?->name,
                'previous_designer_id' => $oldDesignerId,
            ],
        ]);

        // Record in staff audit log
        $this->logStaffAudit($user, $artwork, 'artwork_designer_assigned', [
            'designer_id' => $newDesignerId,
            'designer_name' => $designer?->name,
            'previous_designer_id' => $oldDesignerId,
        ]);

        return response()->json([
            'success' => true,
            'message' => $designer ? "Assigned to {$designer->name}." : 'Artwork unassigned.',
            'data' => $artwork->fresh(['assignedDesigner', 'reviews.reviewer']),
        ]);
    }

    /**
     * Return list of active staff members eligible for designer assignment.
     */
    public function designers(Request $request): JsonResponse
    {
        $designers = User::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->where('is_super_admin', true)
                    ->orWhere('role', 'admin')
                    ->orWhere('role_preset', 'designer')
                    ->orWhereJsonContains('permissions', 'artwork')
                    ->orWhereJsonContains('permissions', 'templates');
            })
            ->select(['id', 'name', 'email', 'role_preset', 'is_super_admin'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $designers,
        ]);
    }

    /**
     * Re-run preflight checks on demand.
     */
    public function runPreflight(Request $request, string $id): JsonResponse
    {
        $artwork = Artwork::findOrFail($id);
        $user = $request->user();

        if ($user->isRestrictedDesigner() && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        $results = $this->validationService->inspectArtwork($artwork);

        $artwork->update([
            'status' => $results['status'],
            'preflight_results' => $results,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Preflight inspection completed.',
            'data' => $results,
        ]);
    }

    /**
     * Upload a new revised artwork version.
     */
    public function uploadVersion(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $artwork = Artwork::findOrFail($id);

        if ($user->isRestrictedDesigner() && (int) $artwork->assigned_designer_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        $validated = $request->validate([
            'file' => 'required|file|max:102400', // max 100MB
            'change_summary' => 'nullable|string|max:1000',
        ]);

        $uploadedFile = $request->file('file');
        $fileName = $uploadedFile->getClientOriginalName();
        $mimeType = $uploadedFile->getMimeType();
        $fileSize = $uploadedFile->getSize();

        $storagePath = $uploadedFile->store('artworks/versions/' . Str::uuid(), 'public');

        $newVersionNumber = $artwork->current_version + 1;

        $newVersion = ArtworkVersion::create([
            'artwork_id' => $artwork->id,
            'version_number' => $newVersionNumber,
            'file_name' => $fileName,
            'file_size_bytes' => $fileSize,
            'mime_type' => $mimeType,
            'storage_disk' => 'public',
            'storage_path' => $storagePath,
            'thumbnail_url' => url('/api/v1/storage/' . $storagePath),
            'uploaded_by' => $user->id,
            'change_summary' => $validated['change_summary'] ?? 'Uploaded revised print asset.',
            'is_approved' => false,
        ]);

        $artwork->update([
            'file_name' => $fileName,
            'file_size_bytes' => $fileSize,
            'mime_type' => $mimeType,
            'storage_disk' => 'public',
            'storage_path' => $storagePath,
            'thumbnail_url' => url('/api/v1/storage/' . $storagePath),
            'current_version' => $newVersionNumber,
            'review_status' => 'pending_review',
        ]);

        // Run preflight on new version
        $preflight = $this->validationService->inspectArtwork($artwork);
        $artwork->update([
            'status' => $preflight['status'],
            'preflight_results' => $preflight,
        ]);

        $newVersion->update(['preflight_results' => $preflight]);

        ArtworkReview::create([
            'artwork_id' => $artwork->id,
            'version_number' => $newVersionNumber,
            'reviewer_id' => $user->id,
            'action' => 'version_uploaded',
            'notes' => "Version {$newVersionNumber} uploaded: " . ($validated['change_summary'] ?? $fileName),
        ]);

        $this->logStaffAudit($user, $artwork, 'artwork_version_uploaded', [
            'version' => $newVersionNumber,
            'file_name' => $fileName,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Version {$newVersionNumber} uploaded successfully.",
            'data' => $artwork->fresh(['versions', 'reviews.reviewer']),
        ]);
    }

    /**
     * Sanitizes artwork payload for scoped designers by removing financial and admin-only notes.
     */
    protected function sanitizeArtworkForUser(Artwork $artwork, bool $isDesigner): Artwork
    {
        if ($isDesigner) {
            // Strip pricing from related order
            if ($artwork->order) {
                $artwork->order->subtotal_ex_gst = null;
                $artwork->order->gst_amount = null;
                $artwork->order->total_inc_gst = null;
                $artwork->order->payment_status = null;
                $artwork->order->unsetRelation('payments');
                $artwork->order->unsetRelation('invoice');
                $artwork->order->admin_notes = null;
            }

            // Strip pricing from related order items
            if ($artwork->relationLoaded('orderItems')) {
                foreach ($artwork->orderItems as $item) {
                    $item->unit_price_ex_gst = null;
                    $item->unit_price_inc_gst = null;
                    $item->total_price_inc_gst = null;
                }
            }

            // Hide internal admin notes
            $artwork->admin_notes = null;
        }

        return $artwork;
    }

    /**
     * Log action to staff audit trail without leaking secrets.
     */
    protected function logStaffAudit(User $actor, Artwork $artwork, string $action, array $metadata = []): void
    {
        StaffAuditLog::create([
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_email' => $actor->email,
            'affected_user_id' => $artwork->user_id,
            'affected_user_name' => $artwork->user?->name,
            'affected_user_email' => $artwork->user?->email,
            'action' => $action,
            'details' => array_merge([
                'artwork_id' => $artwork->id,
                'artwork_name' => $artwork->name,
                'order_id' => $artwork->order_id,
                'order_number' => $artwork->order?->order_number,
            ], $metadata),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
