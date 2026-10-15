<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductType;
use App\Models\Artwork;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ReportsDemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::where('role', 'customer')->first()
            ?? User::firstOrCreate(
                ['email' => 'client.reports@example.com'],
                [
                    'name' => 'Nexus Corporate Agency',
                    'role' => 'customer',
                    'is_active' => true,
                    'password' => bcrypt('password'),
                ]
            );

        $category = Category::firstOrCreate(
            ['slug' => 'commercial-printing'],
            [
                'name' => 'Commercial Printing',
                'is_active' => true,
            ]
        );

        $productCards = Product::firstOrCreate(
            ['slug' => 'deluxe-velvet-business-cards'],
            [
                'category_id' => $category->id,
                'name' => 'Deluxe Velvet Business Cards',
                'sku' => 'BC-VELVET-01',
                'product_type' => ProductType::STATIONERY,
                'width_mm' => 90.0,
                'height_mm' => 54.0,
                'is_active' => true,
            ]
        );

        $productFlyers = Product::firstOrCreate(
            ['slug' => 'a5-promo-flyers'],
            [
                'category_id' => $category->id,
                'name' => 'A5 Full-Color Promo Flyers',
                'sku' => 'FLY-A5-PROMO',
                'product_type' => ProductType::STANDARD_PRINT,
                'width_mm' => 148.0,
                'height_mm' => 210.0,
                'is_active' => true,
            ]
        );

        $productBooklets = Product::firstOrCreate(
            ['slug' => 'saddle-stitched-booklets'],
            [
                'category_id' => $category->id,
                'name' => 'Saddle Stitched Product Booklets (16pp)',
                'sku' => 'BK-SADDLE-16P',
                'product_type' => ProductType::STANDARD_PRINT,
                'width_mm' => 210.0,
                'height_mm' => 297.0,
                'is_active' => true,
            ]
        );

        $productBanners = Product::firstOrCreate(
            ['slug' => 'outdoor-vinyl-mesh-banner'],
            [
                'category_id' => $category->id,
                'name' => 'Outdoor Vinyl Mesh Banner',
                'sku' => 'BAN-MESH-OUT',
                'product_type' => ProductType::SIGNAGE,
                'width_mm' => 1000.0,
                'height_mm' => 3000.0,
                'is_active' => true,
            ]
        );

        $catalog = [
            [
                'product' => $productCards,
                'stock' => '450gsm Velvet Soft-Touch Card',
                'finish' => 'Gold Foil Stamping + Matt Cello',
                'qty' => 1000,
                'unit_price' => 0.18,
            ],
            [
                'product' => $productCards,
                'stock' => '400gsm Heavy Artboard',
                'finish' => 'Matt Cello 2 Sides',
                'qty' => 500,
                'unit_price' => 0.14,
            ],
            [
                'product' => $productFlyers,
                'stock' => '150gsm Gloss Artpaper',
                'finish' => 'Machine Varnish Seal',
                'qty' => 2500,
                'unit_price' => 0.08,
            ],
            [
                'product' => $productFlyers,
                'stock' => '300gsm Recycled Silk Stock',
                'finish' => 'Uncoated Eco Finish',
                'qty' => 1000,
                'unit_price' => 0.12,
            ],
            [
                'product' => $productBooklets,
                'stock' => '200gsm Satin Artpaper Cover / 130gsm Text',
                'finish' => 'Gloss Laminated Cover',
                'qty' => 250,
                'unit_price' => 2.40,
            ],
            [
                'product' => $productBanners,
                'stock' => '510gsm Heavyweight Vinyl Mesh',
                'finish' => 'Hemmed Edges with Eyelets every 500mm',
                'qty' => 4,
                'unit_price' => 85.00,
            ],
        ];

        // Seed 15 sample orders spread over the last 30 days
        $daysBack = [28, 25, 22, 19, 16, 14, 12, 10, 8, 6, 5, 3, 2, 1, 0];

        foreach ($daysBack as $idx => $days) {
            $createdTime = Carbon::now()->subDays($days)->subHours(rand(1, 10));
            $catalogItem = $catalog[$idx % count($catalog)];
            $product = $catalogItem['product'];
            $qty = $catalogItem['qty'];
            $unitPrice = $catalogItem['unit_price'];

            $subtotal = round($qty * $unitPrice, 2);
            $gst = round($subtotal * 0.10, 2);
            $total = round($subtotal + $gst, 2);

            $isCompleted = $days > 4;
            $status = $isCompleted ? OrderStatus::DELIVERED : OrderStatus::IN_PRODUCTION;

            $order = Order::create([
                'order_number' => 'PO-' . date('Y') . '-' . (20000 + $idx),
                'user_id' => $customer->id,
                'status' => $status,
                'payment_status' => PaymentStatus::PAID,
                'subtotal_ex_gst' => $subtotal,
                'gst_amount' => $gst,
                'shipping_fee_inc_gst' => 0.00,
                'discount_amount' => 0.00,
                'total_inc_gst' => $total,
                'currency' => 'AUD',
                'shipping_address' => [
                    'name' => 'Nexus Agency',
                    'address_line_1' => '55 Collins Street',
                    'city' => 'Melbourne',
                    'state' => 'VIC',
                    'postcode' => '3000',
                    'country' => 'Australia',
                ],
                'billing_address' => [
                    'name' => 'Nexus Agency Pty Ltd',
                    'address_line_1' => '55 Collins Street',
                    'city' => 'Melbourne',
                    'state' => 'VIC',
                    'postcode' => '3000',
                    'country' => 'Australia',
                ],
                'shipping_carrier' => 'Australia Post eParcel',
                'created_at' => $createdTime,
                'updated_at' => $createdTime->copy()->addDays(2),
            ]);

            // Artwork
            $approvalTime = $createdTime->copy()->addHours(rand(2, 24));
            $artwork = Artwork::create([
                'id' => (string) Str::uuid(),
                'user_id' => $customer->id,
                'product_id' => $product->id,
                'order_id' => $order->id,
                'name' => $product->name . ' Final Press Ready',
                'file_name' => strtolower($product->sku) . '_print.pdf',
                'source_type' => 'upload',
                'mime_type' => 'application/pdf',
                'file_size_bytes' => rand(2000000, 8000000),
                'storage_disk' => 'public',
                'storage_path' => 'artworks/demo/' . strtolower($product->sku) . '.pdf',
                'status' => 'ready_for_production',
                'review_status' => 'approved',
                'approved_at' => $approvalTime,
                'created_at' => $createdTime,
                'updated_at' => $approvalTime,
            ]);

            // Order Item
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'quantity' => $qty,
                'unit_price_ex_gst' => $unitPrice,
                'unit_price_inc_gst' => round($unitPrice * 1.10, 4),
                'total_price_inc_gst' => $total,
                'options_snapshot' => [
                    'stock' => $catalogItem['stock'],
                    'finish' => $catalogItem['finish'],
                    'size_mm' => ['width' => $product->width_mm, 'height' => $product->height_mm],
                ],
                'artwork_id' => $artwork->id,
                'production_status' => $isCompleted ? 'completed' : 'printing',
                'created_at' => $createdTime,
                'updated_at' => $createdTime->copy()->addDays(2),
            ]);

            // Shipment
            if ($isCompleted) {
                $shippedTime = $approvalTime->copy()->addDays(rand(1, 3));
                $deliveredTime = $shippedTime->copy()->addDays(rand(1, 2));

                Shipment::create([
                    'order_id' => $order->id,
                    'carrier' => 'Australia Post',
                    'consignment_code' => 'AP-' . strtoupper(Str::random(10)),
                    'status' => 'delivered',
                    'shipped_at' => $shippedTime,
                    'delivered_at' => $deliveredTime,
                    'created_at' => $shippedTime,
                    'updated_at' => $deliveredTime,
                ]);
            }
        }
    }
}
