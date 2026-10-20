<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\User;
use App\Services\CustomerImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    /**
     * List customers with their saved artworks, orders, and addresses.
     */
    public function index(Request $request): JsonResponse
    {
        $roleFilter = $request->query('role', 'all'); // 'all', 'customer', 'admin'
        $search = trim((string) $request->query('search', ''));
        $hasArtworks = $request->query('has_artworks');

        $query = User::query()
            ->with([
                'artworks' => function ($q) {
                    $q->with('product:id,name,slug')
                      ->latest();
                },
                'artworks.pages',
                'addresses',
                'orders' => function ($q) {
                    $q->latest()->take(5);
                },
            ])
            ->withCount(['artworks', 'orders']);

        // Role filter
        if ($roleFilter !== 'all') {
            $query->where('role', $roleFilter);
        }

        // Search filter
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('company_name', 'like', "%{$search}%")
                  ->orWhere('abn', 'like', "%{$search}%");
            });
        }

        // Filter by artwork existence
        if ($hasArtworks === 'true' || $hasArtworks === '1') {
            $query->whereHas('artworks');
        } elseif ($hasArtworks === 'false' || $hasArtworks === '0') {
            $query->whereDoesntHave('artworks');
        }

        // Sort by newest registered by default
        $customers = $query->latest('created_at')->get();

        // Transform artworks to ensure enum status and clean structure
        $transformedCustomers = $customers->map(function (User $user) {
            return $this->formatUser($user);
        });

        // Compute summary statistics
        $stats = [
            'total_customers' => User::where('role', 'customer')->count(),
            'total_all_users' => User::count(),
            'customers_with_artworks' => User::whereHas('artworks')->count(),
            'total_saved_artworks' => Artwork::count(),
            'total_customer_artworks' => Artwork::whereNotNull('user_id')->count(),
            'total_guest_artworks' => Artwork::whereNull('user_id')->count(),
            'new_customers_30d' => User::where('created_at', '>=', now()->subDays(30))->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $transformedCustomers,
            'stats' => $stats,
        ]);
    }

    /**
     * Show a single customer by ID.
     */
    public function show(string $id): JsonResponse
    {
        $user = User::with([
            'artworks' => function ($q) {
                $q->with('product:id,name,slug')
                  ->latest();
            },
            'artworks.pages',
            'addresses',
            'orders' => function ($q) {
                $q->latest();
            },
        ])
        ->withCount(['artworks', 'orders'])
        ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Create a new customer with contact details, billing/shipping address, and preferences.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'customer_display_name' => 'nullable|string|max:255',
            'first_name' => 'nullable|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'last_name' => 'nullable|string|max:100',
            'title' => 'nullable|string|max:50',
            'suffix' => 'nullable|string|max:50',
            'company_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'mobile_number' => 'nullable|string|max:50',
            'fax' => 'nullable|string|max:50',
            'other' => 'nullable|string|max:50',
            'website' => 'nullable|string|max:255',
            'cc' => 'nullable|string|max:255',
            'bcc' => 'nullable|string|max:255',
            'abn' => 'nullable|string|max:20',
            'is_sub_customer' => 'nullable|boolean',
            'billing_address' => 'nullable|array',
            'shipping_address' => 'nullable|array',
            'notes' => 'nullable|string',
            'primary_payment_method' => 'nullable|string|max:100',
            'terms' => 'nullable|string|max:100',
        ]);

        $displayName = $validated['customer_display_name'] 
            ?? $validated['name'] 
            ?? trim(($validated['first_name'] ?? '') . ' ' . ($validated['last_name'] ?? ''));

        if (empty($displayName)) {
            $displayName = $validated['company_name'] ?? 'New Customer';
        }

        $email = !empty($validated['email']) ? strtolower(trim($validated['email'])) : null;
        if ($email && User::where('email', $email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'A customer with this email address already exists.',
            ], 422);
        }

        if (!$email) {
            $email = 'cust_' . \Illuminate\Support\Str::random(8) . '@erryimprints.internal';
        }

        $user = User::create([
            'name' => $displayName,
            'email' => $email,
            'phone' => $validated['phone'] ?? $validated['mobile_number'] ?? null,
            'company_name' => $validated['company_name'] ?? null,
            'abn' => $validated['abn'] ?? null,
            'role' => User::ROLE_CUSTOMER,
            'password' => \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(16)),
        ]);

        // Save Billing Address if provided
        if (!empty($validated['billing_address'])) {
            $ba = $validated['billing_address'];
            $user->addresses()->create([
                'type' => 'billing',
                'name' => $displayName,
                'company' => $validated['company_name'] ?? null,
                'address_line_1' => $ba['address_line_1'] ?? $ba['street1'] ?? $ba['street_address_1'] ?? '',
                'address_line_2' => $ba['address_line_2'] ?? $ba['street2'] ?? $ba['street_address_2'] ?? null,
                'suburb' => !empty($ba['city'] ?? $ba['suburb']) ? substr($ba['city'] ?? $ba['suburb'], 0, 255) : 'Sydney',
                'state' => !empty($ba['state']) ? substr($ba['state'], 0, 100) : 'NSW',
                'postcode' => !empty($ba['postcode']) ? substr((string)$ba['postcode'], 0, 20) : '2000',
                'country' => !empty($ba['country']) ? substr($ba['country'], 0, 100) : 'Australia',
                'phone' => $validated['phone'] ?? $validated['mobile_number'] ?? '0000000000',
                'is_default' => true,
            ]);
        }

        // Save Shipping Address if provided
        if (!empty($validated['shipping_address'])) {
            $sa = $validated['shipping_address'];
            $user->addresses()->create([
                'type' => 'shipping',
                'name' => $displayName,
                'company' => $validated['company_name'] ?? null,
                'address_line_1' => $sa['address_line_1'] ?? $sa['street1'] ?? $sa['street_address_1'] ?? '',
                'address_line_2' => $sa['address_line_2'] ?? $sa['street2'] ?? $sa['street_address_2'] ?? null,
                'suburb' => !empty($sa['city'] ?? $sa['suburb']) ? substr($sa['city'] ?? $sa['suburb'], 0, 255) : 'Sydney',
                'state' => !empty($sa['state']) ? substr($sa['state'], 0, 100) : 'NSW',
                'postcode' => !empty($sa['postcode']) ? substr((string)$sa['postcode'], 0, 20) : '2000',
                'country' => !empty($sa['country']) ? substr($sa['country'], 0, 100) : 'Australia',
                'phone' => $validated['phone'] ?? $validated['mobile_number'] ?? '0000000000',
                'is_default' => true,
            ]);
        }

        $user->load(['addresses', 'orders', 'artworks']);

        return response()->json([
            'success' => true,
            'message' => 'Customer created successfully',
            'data' => $this->formatUser($user),
        ], 201);
    }

    /**
     * Update an existing customer.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'customer_display_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:50',
            'abn' => 'nullable|string|max:20',
            'role' => 'nullable|string|in:customer,admin,prepress_operator,staff',
            'billing_address' => 'nullable|array',
            'shipping_address' => 'nullable|array',
        ]);

        $displayName = $validated['customer_display_name'] ?? $validated['name'] ?? $user->name;
        $updateData = [
            'name' => $displayName,
            'email' => !empty($validated['email']) ? $validated['email'] : $user->email,
            'phone' => $validated['phone'] ?? $user->phone,
            'company_name' => $validated['company_name'] ?? $user->company_name,
            'abn' => $validated['abn'] ?? $user->abn,
        ];

        if (!empty($validated['role'])) {
            $updateData['role'] = $validated['role'];
        }

        $user->update($updateData);

        // Update or create Billing Address if provided
        if (isset($validated['billing_address']) && is_array($validated['billing_address'])) {
            $ba = $validated['billing_address'];
            $addressLine1 = $ba['address_line_1'] ?? $ba['street1'] ?? $ba['street_address_1'] ?? '';
            if (!empty($addressLine1)) {
                $user->addresses()->updateOrCreate(
                    ['type' => 'billing'],
                    [
                        'name' => $displayName,
                        'company' => $validated['company_name'] ?? $user->company_name,
                        'address_line_1' => $addressLine1,
                        'address_line_2' => $ba['address_line_2'] ?? $ba['street2'] ?? $ba['street_address_2'] ?? null,
                        'suburb' => !empty($ba['city'] ?? $ba['suburb']) ? substr($ba['city'] ?? $ba['suburb'], 0, 255) : 'Sydney',
                        'state' => !empty($ba['state']) ? substr($ba['state'], 0, 100) : 'NSW',
                        'postcode' => !empty($ba['postcode']) ? substr((string)$ba['postcode'], 0, 20) : '2000',
                        'country' => !empty($ba['country']) ? substr($ba['country'], 0, 100) : 'Australia',
                        'phone' => $validated['phone'] ?? $user->phone ?? '0000000000',
                        'is_default' => true,
                    ]
                );
            }
        }

        // Update or create Shipping Address if provided
        if (isset($validated['shipping_address']) && is_array($validated['shipping_address'])) {
            $sa = $validated['shipping_address'];
            $addressLine1 = $sa['address_line_1'] ?? $sa['street1'] ?? $sa['street_address_1'] ?? '';
            if (!empty($addressLine1)) {
                $user->addresses()->updateOrCreate(
                    ['type' => 'shipping'],
                    [
                        'name' => $displayName,
                        'company' => $validated['company_name'] ?? $user->company_name,
                        'address_line_1' => $addressLine1,
                        'address_line_2' => $sa['address_line_2'] ?? $sa['street2'] ?? $sa['street_address_2'] ?? null,
                        'suburb' => !empty($sa['city'] ?? $sa['suburb']) ? substr($sa['city'] ?? $sa['suburb'], 0, 255) : 'Sydney',
                        'state' => !empty($sa['state']) ? substr($sa['state'], 0, 100) : 'NSW',
                        'postcode' => !empty($sa['postcode']) ? substr((string)$sa['postcode'], 0, 20) : '2000',
                        'country' => !empty($sa['country']) ? substr($sa['country'], 0, 100) : 'Australia',
                        'phone' => $validated['phone'] ?? $user->phone ?? '0000000000',
                        'is_default' => true,
                    ]
                );
            }
        }

        $user->load(['addresses', 'orders', 'artworks']);

        return response()->json([
            'success' => true,
            'message' => 'Customer updated successfully',
            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Retrieve artworks created by guest sessions (unregistered users).
     */
    public function guestArtworks(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $query = Artwork::query()
            ->whereNull('user_id')
            ->with(['product:id,name,slug', 'pages'])
            ->latest('created_at');

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('session_id', 'like', "%{$search}%");
            });
        }

        $artworks = $query->take(50)->get()->map(function (Artwork $art) {
            return $this->formatArtwork($art);
        });

        return response()->json([
            'success' => true,
            'data' => $artworks,
            'total' => Artwork::whereNull('user_id')->count(),
        ]);
    }

    /**
     * Helper to format User model with safe artwork structures.
     */
    protected function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'company_name' => $user->company_name,
            'abn' => $user->abn,
            'role' => $user->role,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
            'artworks_count' => $user->artworks_count ?? $user->artworks->count(),
            'orders_count' => $user->orders_count ?? $user->orders->count(),
            'addresses' => $user->addresses,
            'orders' => $user->orders,
            'artworks' => $user->artworks->map(fn (Artwork $art) => $this->formatArtwork($art))->values(),
        ];
    }

    /**
     * Helper to format Artwork model.
     */
    protected function formatArtwork(Artwork $artwork): array
    {
        $statusValue = is_object($artwork->status) ? ($artwork->status->value ?? (string) $artwork->status) : (string) $artwork->status;

        return [
            'id' => $artwork->id,
            'user_id' => $artwork->user_id,
            'session_id' => $artwork->session_id,
            'name' => $artwork->name ?: 'Untitled Artwork',
            'product_id' => $artwork->product_id,
            'product_name' => $artwork->product?->name ?? 'Custom Product',
            'product_slug' => $artwork->product?->slug,
            'source_type' => $artwork->source_type,
            'design_status' => $artwork->design_status,
            'status' => $statusValue,
            'thumbnail_url' => $this->resolveUrl($artwork->thumbnail_url),
            'public_url' => $this->resolveUrl($artwork->public_url),
            'proof_pdf_url' => $this->resolveUrl($artwork->proof_pdf_url),
            'width_px' => $artwork->width_px,
            'height_px' => $artwork->height_px,
            'dpi' => $artwork->dpi,
            'unit' => $artwork->unit,
            'bleed' => $artwork->bleed,
            'safe_area' => $artwork->safe_area,
            'background_color' => $artwork->background_color,
            'document_settings' => $artwork->document_settings,
            'pages_count' => $artwork->pages ? $artwork->pages->count() : 0,
            'created_at' => $artwork->created_at?->toISOString(),
            'updated_at' => $artwork->updated_at?->toISOString(),
        ];
    }

    /**
     * Resolve asset URL.
     */
    protected function resolveUrl(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://') || str_starts_with($url, 'data:')) {
            return $url;
        }
        if (str_starts_with($url, '/api/v1/storage/')) {
            return url($url);
        }
        if (str_starts_with($url, 'artworks/')) {
            return url('/api/v1/storage/' . $url);
        }
        return url($url);
    }

    /**
     * Preview CSV customer import without persisting.
     */
    public function importPreview(Request $request, CustomerImportService $importService): JsonResponse
    {
        $request->validate([
            'file' => 'required_without:csv_content|file|max:10240',
            'csv_content' => 'required_without:file|string',
            'mapping' => 'nullable',
            'skip_duplicates' => 'nullable',
        ]);

        $file = $request->file('file') ?: $request->input('csv_content');
        $mapping = $request->input('mapping');
        if (is_string($mapping)) {
            $mapping = json_decode($mapping, true);
        }

        $skipDuplicates = filter_var($request->input('skip_duplicates', true), FILTER_VALIDATE_BOOLEAN);

        try {
            $result = $importService->preview($file, is_array($mapping) ? $mapping : null, $skipDuplicates);

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to parse and preview CSV: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Execute CSV customer import into database.
     */
    public function import(Request $request, CustomerImportService $importService): JsonResponse
    {
        $request->validate([
            'file' => 'required_without:csv_content|file|max:10240',
            'csv_content' => 'required_without:file|string',
            'mapping' => 'nullable',
            'skip_duplicates' => 'nullable',
        ]);

        $file = $request->file('file') ?: $request->input('csv_content');
        $mapping = $request->input('mapping');
        if (is_string($mapping)) {
            $mapping = json_decode($mapping, true);
        }

        $skipDuplicates = filter_var($request->input('skip_duplicates', true), FILTER_VALIDATE_BOOLEAN);

        try {
            $result = $importService->import($file, is_array($mapping) ? $mapping : null, $skipDuplicates);

            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Customer import failed: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Download skipped/invalid rows CSV report.
     */
    public function downloadImportReport(Request $request, CustomerImportService $importService)
    {
        $reportCsv = $request->input('report_csv');
        $rows = $request->input('rows');

        if (empty($reportCsv) && is_array($rows)) {
            $reportCsv = $importService->generateReportCsv($rows);
        }

        if (empty($reportCsv)) {
            return response()->json([
                'success' => false,
                'message' => 'No report data provided for download.',
            ], 400);
        }

        return response($reportCsv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="customer-import-report-' . date('Y-m-d-His') . '.csv"',
        ]);
    }
}

