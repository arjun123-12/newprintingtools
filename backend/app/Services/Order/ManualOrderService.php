<?php

namespace App\Services\Order;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Artwork;
use App\Models\ArtworkVersion;
use App\Models\Order;
use App\Models\OrderActivity;
use App\Models\OrderItem;
use App\Models\OrderReviewLink;
use App\Models\Product;
use App\Models\User;
use App\Services\Notification\OrderNotificationService;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ManualOrderService
{
    public function __construct(
        protected OrderNotificationService $notificationService
    ) {}

    /**
     * Create a new manual order as a draft.
     */
    public function createManualOrder(User $staffUser, array $data): Order
    {
        // 1. Resolve customer
        $customer = $this->resolveCustomer($data);

        // 2. Authoritative calculations on server
        $calculated = $this->calculateTotals($data['items'] ?? [], $data['delivery_method'] ?? 'standard', $data['shipping_fee'] ?? null);

        // 3. Generate unique order number
        $orderNumber = $this->generateOrderNumber();

        // 4. Save in DB transaction
        return DB::transaction(function () use ($staffUser, $customer, $calculated, $orderNumber, $data) {
            $order = Order::create([
                'order_number' => $orderNumber,
                'user_id' => $customer->id,
                'status' => OrderStatus::DRAFT,
                'payment_status' => PaymentStatus::UNPAID,
                'subtotal_ex_gst' => $calculated['subtotal_ex_gst'],
                'gst_amount' => $calculated['gst_amount'],
                'shipping_fee_inc_gst' => $calculated['shipping_fee_inc_gst'],
                'discount_amount' => $calculated['discount_amount'],
                'total_inc_gst' => $calculated['total_inc_gst'],
                'currency' => 'AUD',
                'delivery_method' => $data['delivery_method'] ?? 'Standard delivery (Free)',
                'shipping_address' => [
                    'name' => $data['customer_name'] ?? $customer->name,
                    'email' => $data['customer_email'] ?? $customer->email,
                    'phone' => $data['customer_phone'] ?? $customer->phone ?? '',
                    'company' => $data['company_name'] ?? $customer->company_name ?? '',
                    'address_line_1' => $data['delivery_address'] ?? '12 Harper Lane',
                    'city' => $data['city'] ?? 'Richmond',
                    'state' => $data['state'] ?? 'VIC',
                    'postcode' => $data['postcode'] ?? '3121',
                    'country' => 'AU',
                ],
                'billing_address' => [
                    'name' => $data['customer_name'] ?? $customer->name,
                    'email' => $data['customer_email'] ?? $customer->email,
                    'phone' => $data['customer_phone'] ?? $customer->phone ?? '',
                    'company' => $data['company_name'] ?? $customer->company_name ?? '',
                    'address_line_1' => $data['delivery_address'] ?? '12 Harper Lane',
                    'city' => $data['city'] ?? 'Richmond',
                    'state' => $data['state'] ?? 'VIC',
                    'postcode' => $data['postcode'] ?? '3121',
                    'country' => 'AU',
                ],
                'customer_notes' => $data['customer_notes'] ?? null,
                'admin_notes' => $data['internal_notes'] ?? null,
                'current_proof_version' => 1,
            ]);

            // Save order line items
            foreach ($calculated['items'] as $itemData) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $itemData['product_id'],
                    'product_name' => $itemData['product_name'],
                    'product_sku' => $itemData['product_sku'],
                    'quantity' => $itemData['quantity'],
                    'unit_price_ex_gst' => $itemData['unit_price_ex_gst'],
                    'unit_price_inc_gst' => round($itemData['unit_price_ex_gst'] * 1.10, 4),
                    'total_price_inc_gst' => $itemData['line_total_inc_gst'],
                    'options_snapshot' => $itemData['options'] ?? [],
                    'production_status' => 'queued',
                ]);
            }

            // Create initial activity log
            OrderActivity::record(
                $order->id,
                'draft_created',
                'Draft created by ' . ($staffUser->name ?: 'Staff'),
                'staff',
                $staffUser
            );

            return $order->load(['items.product', 'user', 'activities']);
        });
    }

    /**
     * Update an existing manual order.
     */
    public function updateManualOrder(Order $order, User $staffUser, array $data): Order
    {
        if (in_array($order->status, [OrderStatus::IN_PRODUCTION, OrderStatus::DISPATCHED, OrderStatus::DELIVERED])) {
            throw ValidationException::withMessages([
                'order' => ['This order is already in production or completed and cannot be edited.'],
            ]);
        }

        $calculated = $this->calculateTotals(
            $data['items'] ?? [],
            $data['delivery_method'] ?? ($order->delivery_method ?? 'standard'),
            $data['shipping_fee'] ?? null
        );

        return DB::transaction(function () use ($order, $staffUser, $calculated, $data) {
            $shippingAddress = $order->shipping_address ?? [];
            if (!empty($data['delivery_address'])) {
                $shippingAddress['address_line_1'] = $data['delivery_address'];
            }
            if (!empty($data['customer_email'])) {
                $shippingAddress['email'] = $data['customer_email'];
            }

            $order->update([
                'subtotal_ex_gst' => $calculated['subtotal_ex_gst'],
                'gst_amount' => $calculated['gst_amount'],
                'shipping_fee_inc_gst' => $calculated['shipping_fee_inc_gst'],
                'discount_amount' => $calculated['discount_amount'],
                'total_inc_gst' => $calculated['total_inc_gst'],
                'delivery_method' => $data['delivery_method'] ?? $order->delivery_method,
                'shipping_address' => $shippingAddress,
                'customer_notes' => array_key_exists('customer_notes', $data) ? $data['customer_notes'] : $order->customer_notes,
                'admin_notes' => array_key_exists('internal_notes', $data) ? $data['internal_notes'] : $order->admin_notes,
            ]);

            // Replace line items if provided
            if (!empty($data['items'])) {
                $order->items()->delete();
                foreach ($calculated['items'] as $itemData) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $itemData['product_id'],
                        'product_name' => $itemData['product_name'],
                        'product_sku' => $itemData['product_sku'],
                        'quantity' => $itemData['quantity'],
                        'unit_price_ex_gst' => $itemData['unit_price_ex_gst'],
                        'unit_price_inc_gst' => round($itemData['unit_price_ex_gst'] * 1.10, 4),
                        'total_price_inc_gst' => $itemData['line_total_inc_gst'],
                        'options_snapshot' => $itemData['options'] ?? [],
                        'production_status' => 'queued',
                    ]);
                }
            }

            OrderActivity::record(
                $order->id,
                'order_updated',
                'Order details updated by ' . ($staffUser->name ?: 'Staff'),
                'staff',
                $staffUser
            );

            return $order->load(['items.product', 'user', 'activities', 'artworks.versions']);
        });
    }

    /**
     * Upload proof files and attach them as a version to the order.
     * Supports multiple files (e.g. Front and Back files).
     */
    public function uploadProofFiles(Order $order, User $staffUser, array $uploadedFiles, ?int $versionNumber = null): ArtworkVersion
    {
        return DB::transaction(function () use ($order, $staffUser, $uploadedFiles, $versionNumber) {
            // Find or create primary Artwork for this order
            $artwork = Artwork::firstOrCreate(
                ['order_id' => $order->id],
                [
                    'user_id' => $order->user_id,
                    'name' => 'Proof for Order ' . $order->order_number,
                    'source_type' => 'upload',
                    'current_version' => 1,
                    'proof_status' => 'ready',
                ]
            );

            // Determine version number
            $targetVersion = $versionNumber ?: (($artwork->current_version ?: 1) + (ArtworkVersion::where('artwork_id', $artwork->id)->exists() ? 1 : 0));

            $disk = 'public';
            $processedFiles = [];
            $primaryUrl = null;
            $primaryThumb = null;

            foreach ($uploadedFiles as $index => $file) {
                if ($file instanceof UploadedFile) {
                    $originalName = $file->getClientOriginalName();
                    $label = (str_contains(strtolower($originalName), 'back') || $index === 1) ? 'Back' : 'Front';
                    $safeFilename = 'proof_' . $order->order_number . '_v' . $targetVersion . '_' . Str::slug(pathinfo($originalName, PATHINFO_FILENAME)) . '_' . Str::random(6) . '.' . $file->getClientOriginalExtension();
                    
                    $storagePath = $file->storeAs('proofs/' . $order->id, $safeFilename, $disk);
                    $url = Storage::disk($disk)->url($storagePath);

                    $processedFiles[] = [
                        'label' => $label,
                        'file_name' => $originalName,
                        'storage_path' => $storagePath,
                        'url' => $url,
                        'file_size_bytes' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                    ];

                    if (!$primaryUrl) {
                        $primaryUrl = $url;
                        $primaryThumb = $url;
                    }
                } elseif (is_array($file) && !empty($file['url'])) {
                    // Pre-uploaded or existing reference
                    $processedFiles[] = $file;
                    if (!$primaryUrl) {
                        $primaryUrl = $file['url'];
                        $primaryThumb = $file['url'];
                    }
                }
            }

            // Save new ArtworkVersion record
            $version = ArtworkVersion::create([
                'artwork_id' => $artwork->id,
                'version_number' => $targetVersion,
                'file_name' => $processedFiles[0]['file_name'] ?? ('Proof V' . $targetVersion),
                'file_size_bytes' => $processedFiles[0]['file_size_bytes'] ?? 0,
                'mime_type' => $processedFiles[0]['mime_type'] ?? 'application/pdf',
                'storage_disk' => $disk,
                'storage_path' => $processedFiles[0]['storage_path'] ?? null,
                'proof_pdf_url' => $primaryUrl,
                'thumbnail_url' => $primaryThumb,
                'proof_files' => $processedFiles,
                'is_approved' => false,
                'uploaded_by' => $staffUser->id,
                'change_summary' => 'Proof V' . $targetVersion . ' uploaded by ' . ($staffUser->name ?: 'Staff'),
            ]);

            // Update Artwork and Order version pointers
            $artwork->update([
                'current_version' => $targetVersion,
                'proof_pdf_url' => $primaryUrl,
                'thumbnail_url' => $primaryThumb,
                'proof_status' => 'ready',
                'review_status' => 'pending_review',
            ]);

            $order->update([
                'current_proof_version' => $targetVersion,
                // If revision uploaded after changes requested, reset status to artwork_review
                'status' => $order->status === OrderStatus::DRAFT ? OrderStatus::DRAFT : OrderStatus::ARTWORK_REVIEW,
            ]);

            OrderActivity::record(
                $order->id,
                'artwork_uploaded',
                'Proof V' . $targetVersion . ' uploaded by ' . ($staffUser->name ?: 'Staff'),
                'staff',
                $staffUser,
                ['version' => $targetVersion, 'files_count' => count($processedFiles)]
            );

            return $version;
        });
    }

    /**
     * Generate or regenerate a cryptographically secure customer review link.
     */
    public function generateReviewLink(Order $order, ?User $staffUser = null, int $expiresInDays = 30): OrderReviewLink
    {
        return DB::transaction(function () use ($order, $staffUser, $expiresInDays) {
            // Revoke any existing active links for this order
            OrderReviewLink::where('order_id', $order->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'revoked',
                    'revoked_at' => now(),
                    'revoked_by' => $staffUser?->id,
                ]);

            // Generate cryptographically secure unguessable 48-char random token
            $token = Str::random(48);
            $tokenHash = hash('sha256', $token);

            $link = OrderReviewLink::create([
                'order_id' => $order->id,
                'token' => $token,
                'token_hash' => $tokenHash,
                'status' => 'active',
                'expires_at' => now()->addDays($expiresInDays),
                'created_by' => $staffUser?->id,
            ]);

            OrderActivity::record(
                $order->id,
                'review_link_generated',
                'Customer review link generated by ' . ($staffUser ? $staffUser->name : 'System'),
                $staffUser ? 'staff' : 'system',
                $staffUser
            );

            return $link;
        });
    }

    /**
     * Revoke customer review link.
     */
    public function revokeReviewLink(Order $order, User $staffUser): bool
    {
        $updated = OrderReviewLink::where('order_id', $order->id)
            ->where('status', 'active')
            ->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'revoked_by' => $staffUser->id,
            ]);

        if ($updated > 0) {
            OrderActivity::record(
                $order->id,
                'review_link_revoked',
                'Customer review link revoked by ' . ($staffUser->name ?: 'Staff'),
                'staff',
                $staffUser
            );
        }

        return $updated > 0;
    }

    /**
     * Send order proof for customer review.
     */
    public function sendForApproval(Order $order, User $staffUser): array
    {
        return DB::transaction(function () use ($order, $staffUser) {
            // Ensure active link exists
            $link = $order->activeReviewLink;
            if (!$link || !$link->isValid()) {
                $link = $this->generateReviewLink($order, $staffUser);
            }

            // Update order status to artwork_review
            $order->update([
                'status' => OrderStatus::ARTWORK_REVIEW,
            ]);

            $baseUrl = rtrim(config('app.frontend_url', env('FRONTEND_STORE_URL', 'http://localhost:3000')), '/');
            $reviewUrl = "{$baseUrl}/orders/review/{$link->token}";
            $customerEmail = $order->shipping_address['email'] ?? $order->user?->email;

            // Dispatch customer email
            $sent = false;
            if (!empty($customerEmail)) {
                $sent = $this->notificationService->sendProofReviewInvitation($order, $reviewUrl, $customerEmail);
            }

            OrderActivity::record(
                $order->id,
                'customer_notified',
                'Proof V' . ($order->current_proof_version ?? 1) . ' sent to customer (' . $customerEmail . ') by ' . ($staffUser->name ?: 'Staff'),
                'staff',
                $staffUser,
                ['email' => $customerEmail, 'email_sent' => $sent]
            );

            return [
                'success' => true,
                'review_url' => $reviewUrl,
                'token' => $link->token,
                'email_sent' => $sent,
                'order' => $order->fresh(['items.product', 'activities', 'artworks.versions', 'activeReviewLink']),
            ];
        });
    }

    /**
     * Send review or payment reminder to customer with frequency limits (max once every 24h).
     */
    public function sendReminder(Order $order, User $staffUser): array
    {
        if ($order->reminder_sent_at && $order->reminder_sent_at->isAfter(now()->subHours(24))) {
            throw ValidationException::withMessages([
                'reminder' => ['A reminder was already sent in the last 24 hours. Next reminder can be sent after ' . $order->reminder_sent_at->addHours(24)->toDayDateTimeString() . '.'],
            ]);
        }

        $link = $order->activeReviewLink;
        if (!$link || !$link->isValid()) {
            $link = $this->generateReviewLink($order, $staffUser);
        }

        $baseUrl = rtrim(config('app.frontend_url', env('FRONTEND_STORE_URL', 'http://localhost:3000')), '/');
        $reviewUrl = "{$baseUrl}/orders/review/{$link->token}";
        $customerEmail = $order->shipping_address['email'] ?? $order->user?->email;

        $type = $order->status === OrderStatus::PENDING_PAYMENT || $order->status === OrderStatus::APPROVED ? 'payment' : 'approval';
        $sent = $this->notificationService->sendProofReminder($order, $reviewUrl, $customerEmail, $type);

        $order->update([
            'reminder_sent_at' => now(),
        ]);

        OrderActivity::record(
            $order->id,
            'reminder_sent',
            ucfirst($type) . ' reminder sent to customer (' . $customerEmail . ') by ' . ($staffUser->name ?: 'Staff'),
            'staff',
            $staffUser,
            ['type' => $type, 'email' => $customerEmail, 'success' => $sent]
        );

        return [
            'success' => true,
            'message' => 'Reminder dispatched successfully to ' . $customerEmail,
            'email_sent' => $sent,
        ];
    }

    /**
     * Advance order to production when proof is approved and payment verified.
     */
    public function moveToProduction(Order $order, ?User $staffUser = null): Order
    {
        // Security check: Must have approved proof and paid status
        if ($order->payment_status !== PaymentStatus::PAID) {
            throw ValidationException::withMessages([
                'order' => ['Order cannot be moved to production until payment has been verified as paid.'],
            ]);
        }

        if (empty($order->approved_proof_version)) {
            throw ValidationException::withMessages([
                'order' => ['Order cannot be moved to production until the customer has approved a proof version.'],
            ]);
        }

        $order->update([
            'status' => OrderStatus::IN_PRODUCTION,
        ]);

        // Update line items production status
        $order->items()->update(['production_status' => 'printing']);

        OrderActivity::record(
            $order->id,
            'in_production',
            'Order moved to production by ' . ($staffUser ? $staffUser->name : 'System'),
            $staffUser ? 'staff' : 'system',
            $staffUser
        );

        return $order->fresh(['items.product', 'activities']);
    }

    /**
     * Resolve existing or create new customer.
     */
    protected function resolveCustomer(array $data): User
    {
        if (!empty($data['user_id'])) {
            $user = User::find($data['user_id']);
            if ($user) {
                return $user;
            }
        }

        $email = strtolower(trim($data['customer_email'] ?? ''));
        if (empty($email)) {
            throw ValidationException::withMessages([
                'customer_email' => ['Customer email is required.'],
            ]);
        }

        $user = User::where('email', $email)->first();
        if ($user) {
            return $user;
        }

        // Create new customer record with secure random password
        return User::create([
            'name' => $data['customer_name'] ?? 'Customer',
            'email' => $email,
            'phone' => $data['customer_phone'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'role' => User::ROLE_CUSTOMER,
            'password' => bcrypt(Str::random(24)),
            'is_active' => true,
        ]);
    }

    /**
     * Authoritative server-side calculations.
     */
    public function calculateTotals(array $items, string $deliveryMethod = 'standard', ?float $customShippingFee = null): array
    {
        $calculatedItems = [];
        $subtotalExGst = 0.00;

        foreach ($items as $item) {
            $product = null;
            if (!empty($item['product_id'])) {
                $product = Product::find($item['product_id']);
            }

            $productName = $product ? $product->name : ($item['product_name'] ?? 'Custom Print Product');
            $productSku = $product ? ($product->sku ?: 'PRD-' . strtoupper(substr(str_replace('-', '', $product->id), 0, 8))) : 'MANUAL-PRD';
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            
            // Support both direct line/lot price (e.g. 1000 cards for $100) or unit price
            if (isset($item['price'])) {
                $lineTotalExGst = round((float) $item['price'], 2);
                $unitPriceExGst = $quantity > 0 ? round($lineTotalExGst / $quantity, 4) : $lineTotalExGst;
            } elseif (isset($item['line_total_ex_gst'])) {
                $lineTotalExGst = round((float) $item['line_total_ex_gst'], 2);
                $unitPriceExGst = $quantity > 0 ? round($lineTotalExGst / $quantity, 4) : $lineTotalExGst;
            } elseif (isset($item['unit_price_ex_gst'])) {
                $unitPriceExGst = (float) $item['unit_price_ex_gst'];
                $lineTotalExGst = round($quantity * $unitPriceExGst, 2);
            } else {
                $lineTotalExGst = $product ? (float) $product->base_price : 100.00;
                $unitPriceExGst = $quantity > 0 ? round($lineTotalExGst / $quantity, 4) : $lineTotalExGst;
            }

            $lineTotalIncGst = round($lineTotalExGst * 1.10, 2);
            $subtotalExGst += $lineTotalExGst;

            $calculatedItems[] = [
                'product_id' => $product ? $product->id : ($item['product_id'] ?? (string) Str::uuid()),
                'product_name' => $productName,
                'product_sku' => $productSku,
                'quantity' => $quantity,
                'unit_price_ex_gst' => $unitPriceExGst,
                'line_total_ex_gst' => $lineTotalExGst,
                'line_total_inc_gst' => $lineTotalIncGst,
                'options' => $item['options'] ?? [
                    'specifications' => $item['specifications'] ?? 'Standard Specifications',
                ],
            ];
        }

        // Determine shipping fee
        $shippingFee = 0.00;
        if ($customShippingFee !== null) {
            $shippingFee = max(0.00, $customShippingFee);
        } else {
            $methodLower = strtolower($deliveryMethod);
            if (str_contains($methodLower, 'express')) {
                $shippingFee = 15.00;
            } elseif (str_contains($methodLower, 'standard') || str_contains($methodLower, 'pickup')) {
                $shippingFee = 0.00;
            }
        }

        // Australian 10% GST on taxable supply
        $gstAmount = round(($subtotalExGst + $shippingFee) * 0.10, 2);
        $totalIncGst = round($subtotalExGst + $shippingFee + $gstAmount, 2);

        return [
            'items' => $calculatedItems,
            'subtotal_ex_gst' => round($subtotalExGst, 2),
            'shipping_fee_inc_gst' => round($shippingFee, 2),
            'gst_amount' => $gstAmount,
            'discount_amount' => 0.00,
            'total_inc_gst' => $totalIncGst,
            'currency' => 'AUD',
        ];
    }

    /**
     * Generate unique professional manual order number.
     * Format: MO-00XXXX
     */
    protected function generateOrderNumber(): string
    {
        do {
            $number = 'MO-' . str_pad((string) random_int(1000, 99999), 6, '0', STR_PAD_LEFT);
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}
