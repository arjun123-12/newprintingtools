<?php

namespace App\Http\Controllers\Api\V1\Enquiries;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enquiries\StoreCustomerEnquiryRequest;
use App\Http\Requests\Enquiries\UpdateCustomerEnquiryRequest;
use App\Models\CustomerEnquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        if ($request->filled('status') && $request->input('status') !== 'all') {
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

        $enquiry = CustomerEnquiry::find($id);

        if (!$enquiry) {
            return response()->json([
                'success' => false,
                'message' => 'Enquiry not found.',
            ], 404);
        }

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

        $enquiry->delete();

        return response()->json([
            'success' => true,
            'message' => 'Enquiry deleted successfully.',
        ]);
    }
}
