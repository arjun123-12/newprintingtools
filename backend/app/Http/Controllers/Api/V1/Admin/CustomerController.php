<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
