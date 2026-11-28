<?php

namespace App\Services\Cart;

use App\Models\Artwork;
use App\Models\DesignTemplate;
use Illuminate\Validation\ValidationException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Services\Pricing\PricingCalculatorService;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CartService
{
    public function __construct(
        protected PricingCalculatorService $pricingCalculator
    ) {}

    /**
     * Retrieve or initialize a persistent cart for an authenticated user or guest session.
     */
    public function getOrCreateCart(?string $sessionId, ?int $userId): Cart
    {
        $cart = null;

        if ($userId) {
            $cart = DB::transaction(function () use ($sessionId, $userId) {
                $cart = Cart::where('user_id', $userId)->lockForUpdate()->first();
                if (!empty($sessionId)) {
                    $guestCart = Cart::where('session_id', $sessionId)
                        ->whereNull('user_id')
                        ->lockForUpdate()
                        ->first();

                    if ($guestCart && !$cart) {
                        $guestCart->update(['user_id' => $userId]);
                        return $guestCart;
                    }

                    if ($guestCart && $cart) {
                        CartItem::where('cart_id', $guestCart->id)->update(['cart_id' => $cart->id]);
                        $guestCart->delete();
                    }
                }

                return $cart ?? Cart::create([
                    'user_id' => $userId,
                    'session_id' => $sessionId,
                    'currency' => 'AUD',
                ]);
            }, 3);
        } elseif (!empty($sessionId)) {
            $cart = Cart::where('session_id', $sessionId)->whereNull('user_id')->first();

            if (!$cart) {
                $cart = Cart::create([
                    'session_id' => $sessionId,
                    'user_id' => null,
                    'currency' => 'AUD',
                ]);
            }
        } else {
            $newSessionId = (string) Str::uuid();
            $cart = Cart::create([
                'session_id' => $newSessionId,
                'user_id' => null,
                'currency' => 'AUD',
            ]);
        }

        $cart->load([
            'items' => fn ($q) => $q->latest('updated_at'),
            'items.product:id,name,slug',
            'items.artwork:id,name,thumbnail_url,width_px,height_px,dpi,unit,document_settings,design_template_id',
        ]);

        return $cart;
    }

    /**
     * Format cart with computed totals and metadata.
     */
    public function formatCart(Cart $cart): array
    {
        $cart->load([
            'items' => fn ($q) => $q->latest('updated_at'),
            'items.product:id,name,slug',
            'items.artwork:id,name,thumbnail_url,width_px,height_px,dpi,unit,document_settings,design_template_id',
        ]);

        $subtotalExGst = (float) $cart->items->sum('subtotal_ex_gst');
        $gstAmount = (float) $cart->items->sum('gst_amount');
        $totalIncGst = (float) $cart->items->sum('total_inc_gst');
        $itemsCount = (int) $cart->items->sum('quantity');

        return [
            'id' => $cart->id,
            'user_id' => $cart->user_id,
            'session_id' => $cart->session_id,
            'currency' => $cart->currency ?? 'AUD',
            'items_count' => $itemsCount,
            'subtotal_ex_gst' => round($subtotalExGst, 2),
            'gst_amount' => round($gstAmount, 2),
            'total_inc_gst' => round($totalIncGst, 2),
            'items' => $cart->items->map(function (CartItem $item) {
                return [
                    'id' => $item->id,
                    'cart_id' => $item->cart_id,
                    'product_id' => $item->product_id,
                    'product' => $item->product,
                    'quantity' => $item->quantity,
                    'selected_options' => $item->selected_options ?? [],
                    'artwork_id' => $item->artwork_id,
                    'artwork' => $item->artwork,
                    'unit_price_ex_gst' => (float) $item->unit_price_ex_gst,
                    'subtotal_ex_gst' => (float) $item->subtotal_ex_gst,
                    'gst_amount' => (float) $item->gst_amount,
                    'total_inc_gst' => (float) $item->total_inc_gst,
                    'created_at' => $item->created_at?->toIso8601String(),
                    'updated_at' => $item->updated_at?->toIso8601String(),
                ];
            })->values(),
            'created_at' => $cart->created_at?->toIso8601String(),
            'updated_at' => $cart->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Add a configured product with customer artwork to the cart.
     */
    public function addItem(Cart $cart, array $data): CartItem
    {
        $productId = $data['product_id'];
        $quantity = max(1, (int) ($data['quantity'] ?? 100));
        $selectedOptions = $data['selected_options'] ?? [];
        $artworkId = $data['artwork_id'] ?? null;

        // Verify product exists
        $product = Product::findOrFail($productId);

        // Verify artwork if provided
        if ($artworkId) {
            $artwork = Artwork::findOrFail($artworkId);
            // Ensure artwork belongs to this user or session if set
            if ($artwork->user_id) {
                if (!$cart->user_id || (int) $artwork->user_id !== (int) $cart->user_id) {
                    abort(403, 'You do not have permission to add this artwork to your cart.');
                }
            } elseif (!empty($artwork->session_id) && !empty($cart->session_id) && !hash_equals((string) $artwork->session_id, (string) $cart->session_id)) {
                abort(403, 'You do not have permission to add this artwork to your cart.');
            }
        }

        // Calculate price using existing pricing matrix engine
        $priceData = $this->pricingCalculator->calculate([
            'product_id' => $productId,
            'quantity' => $quantity,
            'selected_options' => $selectedOptions,
        ]);

        if (!empty($data['template_id'])) {
            $artwork = $this->createTemplateArtwork($cart, $product, $data['template_id']);
            $artworkId = $artwork->id;
            $selectedOptions['artwork_name'] = $artwork->name;
        }

        // Check if an existing item has identical product, artwork, and options
        $existingItem = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $productId)
            ->where('artwork_id', $artworkId)
            ->first();

        if ($existingItem && json_encode($existingItem->selected_options) === json_encode($selectedOptions)) {
            $newQuantity = $existingItem->quantity + $quantity;
            $newPriceData = $this->pricingCalculator->calculate([
                'product_id' => $productId,
                'quantity' => $newQuantity,
                'selected_options' => $selectedOptions,
            ]);

            $existingItem->update([
                'quantity' => $newQuantity,
                'unit_price_ex_gst' => $newPriceData['unit_price_ex_gst'],
                'subtotal_ex_gst' => $newPriceData['subtotal_ex_gst'],
                'gst_amount' => $newPriceData['gst_amount'],
                'total_inc_gst' => $newPriceData['total_inc_gst'],
            ]);

            $existingItem->load(['product:id,name,slug', 'artwork:id,name,thumbnail_url,width_px,height_px,dpi,unit,document_settings,design_template_id']);
            return $existingItem;
        }

        $item = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $productId,
            'quantity' => $quantity,
            'selected_options' => $selectedOptions,
            'artwork_id' => $artworkId,
            'design_canvas_json' => $data['design_canvas_json'] ?? null,
            'unit_price_ex_gst' => $priceData['unit_price_ex_gst'],
            'subtotal_ex_gst' => $priceData['subtotal_ex_gst'],
            'gst_amount' => $priceData['gst_amount'],
            'total_inc_gst' => $priceData['total_inc_gst'],
        ]);

        $item->load(['product:id,name,slug', 'artwork:id,name,thumbnail_url,width_px,height_px,dpi,unit,document_settings,design_template_id']);
        $cart->touch();

        return $item;
    }

    private function createTemplateArtwork(Cart $cart, Product $product, string $templateId): Artwork
    {
        $template = DesignTemplate::query()
            ->whereKey($templateId)
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->with('pages.productSide')
            ->first();

        if (!$template || !$product->is_active) {
            throw ValidationException::withMessages(['template_id' => 'This template is unavailable for this product.']);
        }

        $pages = $template->pages
            ->sortBy(fn ($page) => $page->productSide?->sort_order ?? 0)
            ->pluck('canvas_json')
            ->values()
            ->all();
        if (!$pages) {
            $canvas = $template->canvas_json ?? [];
            $pages = array_is_list($canvas) ? $canvas : [$canvas];
            if ($template->back_canvas_json && count($pages) < 2) {
                $pages[] = $template->back_canvas_json;
            }
        }

        if (!$pages || collect($pages)->contains(fn ($page) => !is_array($page) || !isset($page['objects']))) {
            throw ValidationException::withMessages(['template_id' => 'This template has no printable artwork.']);
        }

        $config = $template->artwork_config ?? [];
        $sides = $product->print_sides ?? $template->print_sides ?? 'front';
        if (in_array($sides, ['both', 'double'], true) && count($pages) === 1) {
            $pages[] = ['version' => $pages[0]['version'] ?? '6.0.0', 'objects' => [], 'background' => '#ffffff'];
        }

        $dpi = max(72, min(1200, (int) ($config['dpi'] ?? 300)));
        $hasSizeInMm = ($product->width_mm && $product->height_mm) || ($template->width_mm && $template->height_mm);
        $width = (float) ($product->width_mm ?: ($template->width_mm ?: ($config['width'] ?? 90)));
        $height = (float) ($product->height_mm ?: ($template->height_mm ?: ($config['height'] ?? 50)));
        $unit = $hasSizeInMm ? 'mm' : ($config['unit'] ?? 'mm');
        $pixelsPerUnit = match ($unit) {
            'px' => 1,
            'in' => $dpi,
            default => $dpi / 25.4,
        };

        return Artwork::create([
            'user_id' => $cart->user_id,
            'session_id' => $cart->user_id ? null : $cart->session_id,
            'product_id' => $product->id,
            'design_template_id' => $template->id,
            'name' => $template->name,
            'source_type' => 'designer',
            'design_status' => 'draft',
            'canvas_json' => $pages,
            'document_settings' => array_replace($config, [
                'width' => $width,
                'height' => $height,
                'unit' => $unit,
                'dpi' => $dpi,
                'printSides' => count($pages) > 1 ? 'both' : $sides,
                'printLayout' => $product->print_layout ?? $config['print_layout'] ?? null,
            ]),
            'width_px' => max(1, (int) round($width * $pixelsPerUnit)),
            'height_px' => max(1, (int) round($height * $pixelsPerUnit)),
            'dpi' => $dpi,
            'unit' => $unit,
            'thumbnail_url' => $template->thumbnail_url,
            'storage_disk' => config('filesystems.default', 'public'),
        ]);
    }

    /**
     * Update quantity and recompute price for a cart item (scoped to the user's cart).
     */
    public function updateItem(Cart $cart, string $itemId, int $quantity, ?array $selectedOptions = null): CartItem
    {
        $item = CartItem::where('cart_id', $cart->id)->findOrFail($itemId);

        $quantity = max(1, $quantity);
        $options = $selectedOptions ?? $item->selected_options ?? [];

        $priceData = $this->pricingCalculator->calculate([
            'product_id' => $item->product_id,
            'quantity' => $quantity,
            'selected_options' => $options,
        ]);

        $item->update([
            'quantity' => $quantity,
            'selected_options' => $options,
            'unit_price_ex_gst' => $priceData['unit_price_ex_gst'],
            'subtotal_ex_gst' => $priceData['subtotal_ex_gst'],
            'gst_amount' => $priceData['gst_amount'],
            'total_inc_gst' => $priceData['total_inc_gst'],
        ]);

        $item->load(['product:id,name,slug', 'artwork:id,name,thumbnail_url,width_px,height_px,dpi,unit,document_settings,design_template_id']);
        $cart->touch();

        return $item;
    }

    /**
     * Remove an item from the user's cart.
     */
    public function removeItem(Cart $cart, string $itemId): bool
    {
        $item = CartItem::where('cart_id', $cart->id)->findOrFail($itemId);
        $deleted = (bool) $item->delete();
        $cart->touch();

        return $deleted;
    }

    /**
     * Clear all items from the user's cart.
     */
    public function clearCart(Cart $cart): bool
    {
        CartItem::where('cart_id', $cart->id)->delete();
        $cart->touch();

        return true;
    }
}
