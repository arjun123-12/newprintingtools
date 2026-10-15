<?php

namespace Database\Seeders;

use App\Enums\ArtworkStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Artwork;
use App\Models\ArtworkReview;
use App\Models\ArtworkVersion;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ArtworkQueueSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure a dedicated designer user exists
        $designerUser = User::firstOrCreate(
            ['email' => 'designer@printecommerce.com.au'],
            [
                'name' => 'Sarah Designer',
                'phone' => '0412 345 678',
                'role' => 'staff',
                'role_preset' => 'designer',
                'permissions' => ['artwork', 'templates', 'design_assets'],
                'password' => Hash::make('Designer2026!'),
                'is_active' => true,
                'is_super_admin' => false,
                'email_verified_at' => now(),
            ]
        );

        $superAdmin = User::where('is_super_admin', true)->first()
            ?? User::where('role', 'admin')->first();

        // 2. Ensure customer user exists
        $customer = User::firstOrCreate(
            ['email' => 'customer.test@example.com'],
            [
                'name' => 'Acme Corp Marketing',
                'phone' => '0499 111 222',
                'company_name' => 'Acme Corporation Pty Ltd',
                'role' => 'customer',
                'password' => Hash::make('Customer2026!'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        // 3. Find or create products for demonstration
        $defaultCat = \App\Models\Category::first() ?? \App\Models\Category::create([
            'name' => 'General Commercial Print',
            'slug' => 'general-commercial-print',
            'is_active' => true,
        ]);

        $productCards = Product::where('slug', 'like', '%card%')->first()
            ?? Product::create([
                'category_id' => $defaultCat?->id,
                'name' => 'Premium Matt Business Cards',
                'slug' => 'premium-matt-business-cards',
                'sku' => 'BC-MATT-9054',
                'product_type' => \App\Enums\ProductType::STATIONERY,
                'width_mm' => 90.0,
                'height_mm' => 54.0,
                'bleed_mm' => 2.0,
                'is_active' => true,
            ]);

        $productFlyer = Product::where('slug', 'like', '%flyer%')->orWhere('slug', 'like', '%poster%')->first()
            ?? Product::create([
                'category_id' => $defaultCat?->id,
                'name' => 'A4 Promotional Gloss Flyers',
                'slug' => 'a4-promotional-gloss-flyers',
                'sku' => 'FLY-A4-GLOSS',
                'product_type' => \App\Enums\ProductType::STANDARD_PRINT,
                'width_mm' => 210.0,
                'height_mm' => 297.0,
                'bleed_mm' => 3.0,
                'is_active' => true,
            ]);

        $productBanner = Product::where('slug', 'like', '%banner%')->first()
            ?? Product::create([
                'category_id' => $defaultCat?->id,
                'name' => 'Pull-Up Retractable Banner (850x2000mm)',
                'slug' => 'pull-up-retractable-banner',
                'sku' => 'BAN-PULL-8520',
                'product_type' => \App\Enums\ProductType::SIGNAGE,
                'width_mm' => 850.0,
                'height_mm' => 2000.0,
                'bleed_mm' => 5.0,
                'is_active' => true,
            ]);

        // 4. Sample Submissions Data
        $submissions = [
            [
                'order_number' => 'PO-2026-10491',
                'product' => $productCards,
                'name' => 'Executive Business Card - Front & Back',
                'file_name' => 'acme_exec_cards_cmyk_300dpi.pdf',
                'source_type' => 'upload',
                'mime_type' => 'application/pdf',
                'file_size_bytes' => 4823449, // ~4.6 MB
                'width_px' => 1114, // 90mm + 2mm bleed at 300 DPI = ~1114px
                'height_px' => 685,  // 54mm + 2mm bleed at 300 DPI = ~685px
                'dpi' => 300,
                'bleed' => 2.0,
                'safe_area' => 3.0,
                'status' => ArtworkStatus::PREFLIGHT_PASSED,
                'review_status' => 'pending_review',
                'assigned_designer' => $designerUser,
                'proof_status' => 'generated',
                'thumbnail_url' => 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
                'created_at' => now()->subHours(3),
                'order_amount' => 189.50,
                'change_notes' => null,
            ],
            [
                'order_number' => 'PO-2026-10488',
                'product' => $productFlyer,
                'name' => 'Spring Festival Promotional Flyer',
                'file_name' => 'spring_festival_flyer_web_export.jpg',
                'source_type' => 'upload',
                'mime_type' => 'image/jpeg',
                'file_size_bytes' => 894320, // ~873 KB
                'width_px' => 1240, // 210mm at only ~150 DPI = 1240px (Low resolution warning)
                'height_px' => 1754,
                'dpi' => 150,
                'bleed' => 0.0, // Missing bleed
                'safe_area' => 0.0,
                'status' => ArtworkStatus::PREFLIGHT_WARNING,
                'review_status' => 'pending_review',
                'assigned_designer' => $designerUser,
                'proof_status' => 'none',
                'thumbnail_url' => 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&q=80',
                'created_at' => now()->subHours(7),
                'order_amount' => 345.00,
                'change_notes' => null,
            ],
            [
                'order_number' => 'PO-2026-10482',
                'product' => $productCards,
                'name' => 'Sunrise Cafe Loyalty Punch Card',
                'file_name' => 'loyalty_card_screenshot_72dpi.png',
                'source_type' => 'upload',
                'mime_type' => 'image/png',
                'file_size_bytes' => 192800, // ~188 KB
                'width_px' => 350, // Critical low resolution: 350px / (90/25.4) = ~98 DPI
                'height_px' => 210,
                'dpi' => 72,
                'bleed' => 0.0,
                'safe_area' => 0.0,
                'status' => ArtworkStatus::PREFLIGHT_FAILED,
                'review_status' => 'changes_requested',
                'assigned_designer' => $designerUser,
                'proof_status' => 'none',
                'thumbnail_url' => 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&w=400&q=80',
                'created_at' => now()->subDay(),
                'order_amount' => 95.00,
                'change_notes' => 'Resolution is critically low (72 DPI). Text and logos will appear extremely blurry and pixelated. Please re-export from Illustrator or Canva as "PDF Print" with at least 300 DPI and 2mm bleed.',
            ],
            [
                'order_number' => 'PO-2026-10475',
                'product' => $productBanner,
                'name' => 'Trade Show Exhibition Backdrop',
                'file_name' => 'tradeshow_banner_vector_cmyk.ai',
                'source_type' => 'upload',
                'mime_type' => 'application/illustrator',
                'file_size_bytes' => 24500000, // ~24.5 MB
                'width_px' => 10039, // 850mm at 300 DPI
                'height_px' => 23622,
                'dpi' => 300,
                'bleed' => 5.0,
                'safe_area' => 50.0,
                'status' => ArtworkStatus::READY_FOR_PRODUCTION,
                'review_status' => 'approved',
                'assigned_designer' => $designerUser,
                'proof_status' => 'customer_approved',
                'thumbnail_url' => 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=400&q=80',
                'created_at' => now()->subDays(2),
                'order_amount' => 520.00,
                'change_notes' => null,
            ],
            [
                'order_number' => 'PO-2026-10469',
                'product' => $productCards,
                'name' => 'Boutique Coffee Roasters Business Cards',
                'file_name' => 'missing_customer_file_unreachable.pdf',
                'source_type' => 'upload',
                'mime_type' => 'application/pdf',
                'file_size_bytes' => 0,
                'width_px' => null,
                'height_px' => null,
                'dpi' => null,
                'bleed' => null,
                'safe_area' => null,
                'status' => ArtworkStatus::PREFLIGHT_FAILED,
                'review_status' => 'pending_review',
                'assigned_designer' => null, // Unassigned submission
                'proof_status' => 'none',
                'thumbnail_url' => null,
                'created_at' => now()->subDays(3),
                'order_amount' => 110.00,
                'change_notes' => null,
            ],
        ];

        foreach ($submissions as $sub) {
            // Create corresponding Order
            $order = Order::firstOrCreate(
                ['order_number' => $sub['order_number']],
                [
                    'user_id' => $customer->id,
                    'status' => OrderStatus::ARTWORK_REVIEW,
                    'payment_status' => PaymentStatus::PAID,
                    'subtotal_ex_gst' => round($sub['order_amount'] / 1.10, 2),
                    'gst_amount' => round($sub['order_amount'] - ($sub['order_amount'] / 1.10), 2),
                    'shipping_fee_inc_gst' => 0.00,
                    'discount_amount' => 0.00,
                    'total_inc_gst' => $sub['order_amount'],
                    'currency' => 'AUD',
                    'shipping_address' => [
                        'name' => 'Acme Marketing Dept',
                        'address_line_1' => '100 Queen Street',
                        'city' => 'Melbourne',
                        'state' => 'VIC',
                        'postcode' => '3000',
                        'country' => 'Australia',
                    ],
                    'billing_address' => [
                        'name' => 'Acme Corporation Pty Ltd',
                        'address_line_1' => '100 Queen Street',
                        'city' => 'Melbourne',
                        'state' => 'VIC',
                        'postcode' => '3000',
                        'country' => 'Australia',
                    ],
                    'shipping_carrier' => 'StarTrack Express',
                    'created_at' => $sub['created_at'],
                ]
            );

            // Create Artwork record
            $artwork = Artwork::create([
                'id' => (string) Str::uuid(),
                'user_id' => $customer->id,
                'product_id' => $sub['product']->id,
                'order_id' => $order->id,
                'assigned_designer_id' => $sub['assigned_designer']?->id,
                'name' => $sub['name'],
                'file_name' => $sub['file_name'],
                'source_type' => $sub['source_type'],
                'mime_type' => $sub['mime_type'],
                'file_size_bytes' => $sub['file_size_bytes'],
                'storage_disk' => 'public',
                'storage_path' => 'artworks/demo/' . $sub['file_name'],
                'thumbnail_url' => $sub['thumbnail_url'],
                'proof_pdf_url' => $sub['thumbnail_url'],
                'width_px' => $sub['width_px'],
                'height_px' => $sub['height_px'],
                'dpi' => $sub['dpi'],
                'bleed' => $sub['bleed'],
                'safe_area' => $sub['safe_area'],
                'status' => $sub['status'],
                'review_status' => $sub['review_status'],
                'proof_status' => $sub['proof_status'],
                'proof_generated_at' => $sub['proof_status'] !== 'none' ? now() : null,
                'approved_by' => $sub['review_status'] === 'approved' ? $superAdmin?->id : null,
                'approved_at' => $sub['review_status'] === 'approved' ? now() : null,
                'admin_notes' => $sub['change_notes'],
                'current_version' => 1,
                'created_at' => $sub['created_at'],
                'updated_at' => $sub['created_at'],
            ]);

            // Create OrderItem linking Order to Artwork
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $sub['product']->id,
                'product_name' => $sub['product']->name,
                'product_sku' => $sub['product']->sku ?: 'SKU-DEMO',
                'quantity' => 500,
                'unit_price_ex_gst' => round(($sub['order_amount'] / 1.10) / 500, 4),
                'unit_price_inc_gst' => round($sub['order_amount'] / 500, 4),
                'total_price_inc_gst' => $sub['order_amount'],
                'options_snapshot' => [
                    'size_mm' => ['width' => $sub['product']->width_mm, 'height' => $sub['product']->height_mm],
                    'stock' => '400gsm Heavy Artboard',
                    'finish' => 'Matt Cello 2 Sides',
                ],
                'artwork_id' => $artwork->id,
                'production_status' => $sub['review_status'] === 'approved' ? 'prepress' : 'queued',
            ]);

            // Create initial Version record
            ArtworkVersion::create([
                'artwork_id' => $artwork->id,
                'version_number' => 1,
                'file_name' => $sub['file_name'],
                'file_size_bytes' => $sub['file_size_bytes'],
                'mime_type' => $sub['mime_type'],
                'storage_disk' => 'public',
                'storage_path' => 'artworks/demo/' . $sub['file_name'],
                'thumbnail_url' => $sub['thumbnail_url'],
                'proof_pdf_url' => $sub['thumbnail_url'],
                'width_px' => $sub['width_px'],
                'height_px' => $sub['height_px'],
                'dpi' => $sub['dpi'],
                'color_profile' => $sub['file_size_bytes'] > 0 ? ($sub['mime_type'] === 'image/jpeg' ? 'RGB' : 'CMYK') : 'Unreadable',
                'is_approved' => $sub['review_status'] === 'approved',
                'uploaded_by' => $customer->id,
                'change_summary' => 'Initial customer file upload at checkout.',
                'created_at' => $sub['created_at'],
            ]);

            // Create initial Review history entry
            ArtworkReview::create([
                'artwork_id' => $artwork->id,
                'version_number' => 1,
                'reviewer_id' => $sub['assigned_designer']?->id ?? $superAdmin?->id ?? $customer->id,
                'action' => $sub['review_status'] === 'approved'
                    ? 'approved'
                    : ($sub['review_status'] === 'changes_requested' ? 'changes_requested' : 'preflight_run'),
                'notes' => $sub['change_notes'] ?: ($sub['review_status'] === 'approved' ? 'Artwork approved for press.' : 'Preflight automated check completed.'),
                'created_at' => $sub['created_at'],
            ]);
        }
    }
}
