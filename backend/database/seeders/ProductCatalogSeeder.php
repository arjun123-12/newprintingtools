<?php

namespace Database\Seeders;

use App\Enums\ProductType;
use App\Models\Category;
use App\Models\PricingMatrix;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductPrintArea;
use Illuminate\Database\Seeder;

class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $cardsCat = Category::where('slug', 'business-cards')->first();
        $flyersCat = Category::where('slug', 'flyers-marketing')->first();
        $signageCat = Category::where('slug', 'signage-banners')->first();
        $stickersCat = Category::where('slug', 'stickers-labels')->first();

        // ==========================================================
        // 1. PRODUCT: PREMIUM 450GSM BUSINESS CARDS (AU Standard 90x55mm)
        // ==========================================================
        if ($cardsCat) {
            $bc = Product::firstOrCreate(
                ['slug' => 'premium-business-cards'],
                [
                    'category_id' => $cardsCat->id,
                    'name' => 'Premium 450gsm Business Cards',
                    'sku' => 'BC-450-STD',
                    'short_description' => '\'s favorite heavy-weight business card with luxury celloglaze finishes.',
                    'description' => 'Printed on ultra-thick 450gsm artboard with high-definition digital offset technology. Choose from premium matt celloglaze, high gloss, spot UV, or velvet touch.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 3,
                    'is_active' => true,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=800&q=80',
                    ],
                ]
            );

            // Print Area: n Standard 90mm x 55mm (+ 2mm Bleed, 3mm Safe Zone)
            ProductPrintArea::firstOrCreate(
                ['product_id' => $bc->id, 'name' => 'Front Side'],
                [
                    'width_mm' => 90.00,
                    'height_mm' => 55.00,
                    'bleed_mm' => 2.00,
                    'safe_zone_mm' => 3.00,
                    'cut_line_color' => '#FF0000',
                ]
            );

            ProductPrintArea::firstOrCreate(
                ['product_id' => $bc->id, 'name' => 'Back Side'],
                [
                    'width_mm' => 90.00,
                    'height_mm' => 55.00,
                    'bleed_mm' => 2.00,
                    'safe_zone_mm' => 3.00,
                    'cut_line_color' => '#FF0000',
                ]
            );

            // Attribute 1: Printed Sides
            $sidesAttr = ProductAttribute::firstOrCreate(
                ['product_id' => $bc->id, 'code' => 'printed_sides'],
                ['name' => 'Printed Sides', 'type' => 'radio', 'is_required' => true, 'sort_order' => 1]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $sidesAttr->id, 'value' => 'single_sided'],
                ['label' => 'Single Sided (Front Only)', 'price_modifier_type' => 'fixed', 'price_modifier_amount' => 0.00, 'sort_order' => 1]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $sidesAttr->id, 'value' => 'double_sided'],
                ['label' => 'Double Sided (Front & Back)', 'price_modifier_type' => 'percentage', 'price_modifier_amount' => 0.20, 'sort_order' => 2]
            );

            // Attribute 2: Lamination Finish
            $finishAttr = ProductAttribute::firstOrCreate(
                ['product_id' => $bc->id, 'code' => 'finish'],
                ['name' => 'Lamination Finish', 'type' => 'select', 'is_required' => true, 'sort_order' => 2]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $finishAttr->id, 'value' => 'none'],
                ['label' => 'Uncoated / Raw Satin', 'price_modifier_amount' => 0.00, 'sort_order' => 1]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $finishAttr->id, 'value' => 'matt_two_sides'],
                ['label' => 'Matt Celloglaze (Both Sides)', 'price_modifier_amount' => 15.00, 'sort_order' => 2]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $finishAttr->id, 'value' => 'gloss_two_sides'],
                ['label' => 'Gloss Celloglaze (Both Sides)', 'price_modifier_amount' => 15.00, 'sort_order' => 3]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $finishAttr->id, 'value' => 'spot_uv'],
                ['label' => 'Matt Celloglaze + Spot UV 1 Side', 'price_modifier_amount' => 45.00, 'sort_order' => 4]
            );

            // Quantity Breaks & Tiered Pricing (AUD ex-GST)
            $quantityBreaks = [
                ['qty' => 250, 'unit' => 0.28, 'setup' => 20.00],
                ['qty' => 500, 'unit' => 0.20, 'setup' => 20.00],
                ['qty' => 1000, 'unit' => 0.14, 'setup' => 15.00],
                ['qty' => 2500, 'unit' => 0.095, 'setup' => 0.00],
                ['qty' => 5000, 'unit' => 0.075, 'setup' => 0.00],
            ];

            foreach ($quantityBreaks as $qb) {
                PricingMatrix::firstOrCreate(
                    ['product_id' => $bc->id, 'quantity' => $qb['qty']],
                    [
                        'unit_price_ex_gst' => $qb['unit'],
                        'setup_fee' => $qb['setup'],
                        'discount_percentage' => round((1 - ($qb['unit'] / 0.28)) * 100, 2),
                    ]
                );
            }
        }

        // ==========================================================
        // 2. PRODUCT: GLOSS MARKETING FLYERS (A4 / A5 / DL)
        // ==========================================================
        if ($flyersCat) {
            $flyer = Product::firstOrCreate(
                ['slug' => 'gloss-marketing-flyers'],
                [
                    'category_id' => $flyersCat->id,
                    'name' => 'Gloss Marketing Flyers',
                    'sku' => 'FLY-150-GLOSS',
                    'short_description' => 'Vibrant 150gsm gloss artpaper flyers ideal for letterbox drops and promotions.',
                    'description' => 'Full-colour commercial offset printing with rich vibrant inks on high-bulk 150gsm gloss art paper.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 2,
                    'is_active' => true,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=800&q=80',
                ]
            );

            // Print Area: A4 (210 x 297mm)
            ProductPrintArea::firstOrCreate(
                ['product_id' => $flyer->id, 'name' => 'A4 Page'],
                [
                    'width_mm' => 210.00,
                    'height_mm' => 297.00,
                    'bleed_mm' => 2.00,
                    'safe_zone_mm' => 4.00,
                ]
            );

            // Attribute: Paper Size
            $sizeAttr = ProductAttribute::firstOrCreate(
                ['product_id' => $flyer->id, 'code' => 'size'],
                ['name' => 'Finished Size', 'type' => 'select', 'is_required' => true, 'sort_order' => 1]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $sizeAttr->id, 'value' => 'a4'],
                ['label' => 'A4 (210 x 297 mm)', 'price_modifier_amount' => 0.00, 'sort_order' => 1]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $sizeAttr->id, 'value' => 'a5'],
                ['label' => 'A5 (148 x 210 mm)', 'price_modifier_type' => 'multiplier', 'price_modifier_amount' => 0.65, 'sort_order' => 2]
            );
            ProductAttributeValue::firstOrCreate(
                ['product_attribute_id' => $sizeAttr->id, 'value' => 'dl'],
                ['label' => 'DL (99 x 210 mm)', 'price_modifier_type' => 'multiplier', 'price_modifier_amount' => 0.50, 'sort_order' => 3]
            );

            // Quantity Breaks
            $flyerQty = [
                ['qty' => 250, 'unit' => 0.45, 'setup' => 25.00],
                ['qty' => 500, 'unit' => 0.32, 'setup' => 25.00],
                ['qty' => 1000, 'unit' => 0.22, 'setup' => 20.00],
                ['qty' => 2500, 'unit' => 0.14, 'setup' => 0.00],
                ['qty' => 5000, 'unit' => 0.09, 'setup' => 0.00],
            ];

            foreach ($flyerQty as $fq) {
                PricingMatrix::firstOrCreate(
                    ['product_id' => $flyer->id, 'quantity' => $fq['qty']],
                    [
                        'unit_price_ex_gst' => $fq['unit'],
                        'setup_fee' => $fq['setup'],
                        'discount_percentage' => round((1 - ($fq['unit'] / 0.45)) * 100, 2),
                    ]
                );
            }
        }

        // ==========================================================
        // 3. PRODUCT: PULL-UP RETRACTABLE BANNER (850 x 2000mm)
        // ==========================================================
        if ($signageCat) {
            $banner = Product::firstOrCreate(
                ['slug' => 'pull-up-banner-standard'],
                [
                    'category_id' => $signageCat->id,
                    'name' => 'Standard Pull-Up Banner (850 x 2000mm)',
                    'sku' => 'BAN-850-STD',
                    'short_description' => 'Portable trade show banner with heavy aluminium base and padded carry bag.',
                    'description' => 'Printed high-resolution on anti-curl satin blockout polypropylene film for crisp graphics and zero transparency.',
                    'product_type' => ProductType::SIGNAGE,
                    'min_quantity' => 1,
                    'turnaround_days' => 2,
                    'is_active' => true,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
                ]
            );

            ProductPrintArea::firstOrCreate(
                ['product_id' => $banner->id, 'name' => 'Banner Face'],
                [
                    'width_mm' => 850.00,
                    'height_mm' => 2000.00,
                    'bleed_mm' => 5.00,
                    'safe_zone_mm' => 10.00,
                ]
            );

            $bannerQty = [
                ['qty' => 1, 'unit' => 125.00, 'setup' => 0.00],
                ['qty' => 2, 'unit' => 110.00, 'setup' => 0.00],
                ['qty' => 5, 'unit' => 95.00, 'setup' => 0.00],
                ['qty' => 10, 'unit' => 85.00, 'setup' => 0.00],
            ];

            foreach ($bannerQty as $bq) {
                PricingMatrix::firstOrCreate(
                    ['product_id' => $banner->id, 'quantity' => $bq['qty']],
                    [
                        'unit_price_ex_gst' => $bq['unit'],
                        'setup_fee' => $bq['setup'],
                        'discount_percentage' => round((1 - ($bq['unit'] / 125.00)) * 100, 2),
                    ]
                );
            }
        }
    }
}
