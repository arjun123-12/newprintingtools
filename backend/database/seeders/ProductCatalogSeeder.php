<?php

namespace Database\Seeders;

use App\Enums\ProductType;
use App\Models\Category;
use App\Models\PricingMatrix;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductPrintArea;
use App\Models\ProductSide;
use Illuminate\Database\Seeder;

class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $cardsCat = Category::where('slug', 'business-cards')->first();
        $flyersCat = Category::where('slug', 'flyers-marketing')->first();
        $signageCat = Category::where('slug', 'signage-banners')->first();
        $stickersCat = Category::where('slug', 'stickers-labels')->first();
        $stationeryCat = Category::where('slug', 'stationery-booklets')->first();

        // =========================================================================
        // CATEGORY 1: BUSINESS CARDS
        // =========================================================================
        if ($cardsCat) {
            // 1. Premium 450gsm Business Cards
            $this->seedProduct(
                category: $cardsCat,
                productData: [
                    'name' => 'Premium 450gsm Business Cards',
                    'slug' => 'premium-business-cards',
                    'sku' => 'BC-450-STD',
                    'short_description' => 'Heavy-weight 450gsm business card with luxury celloglaze finishes.',
                    'description' => 'Printed on ultra-thick 450gsm artboard with high-definition digital offset technology. Choose from premium matt celloglaze, high gloss, spot UV, or velvet touch.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 3,
                    'base_price' => 39.00,
                    'sale_price' => 34.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 90.00,
                    'height_mm' => 55.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Side', 'type' => 'front', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                    ['name' => 'Back Side', 'type' => 'back', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [
                    [
                        'name' => 'Printed Sides',
                        'code' => 'printed_sides',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Single Sided (Front Only)', 'value' => 'single_sided', 'price_modifier_type' => 'fixed', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Double Sided (Front & Back)', 'value' => 'double_sided', 'price_modifier_type' => 'percentage', 'price_modifier_amount' => 0.20, 'sort_order' => 2],
                        ],
                    ],
                    [
                        'name' => 'Lamination Finish',
                        'code' => 'finish',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 2,
                        'values' => [
                            ['label' => 'Uncoated / Raw Satin', 'value' => 'none', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Matt Celloglaze (Both Sides)', 'value' => 'matt_two_sides', 'price_modifier_amount' => 15.00, 'sort_order' => 2],
                            ['label' => 'Gloss Celloglaze (Both Sides)', 'value' => 'gloss_two_sides', 'price_modifier_amount' => 15.00, 'sort_order' => 3],
                            ['label' => 'Matt Celloglaze + Spot UV 1 Side', 'value' => 'spot_uv', 'price_modifier_amount' => 45.00, 'sort_order' => 4],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.28, 'setup' => 20.00],
                    ['qty' => 500, 'unit' => 0.20, 'setup' => 20.00],
                    ['qty' => 1000, 'unit' => 0.14, 'setup' => 15.00],
                    ['qty' => 2500, 'unit' => 0.095, 'setup' => 0.00],
                    ['qty' => 5000, 'unit' => 0.075, 'setup' => 0.00],
                ]
            );

            // 2. Luxury Velvet Soft-Touch Business Cards
            $this->seedProduct(
                category: $cardsCat,
                productData: [
                    'name' => 'Luxury Velvet Soft-Touch Business Cards',
                    'slug' => 'luxury-velvet-business-cards',
                    'sku' => 'BC-VELVET-450',
                    'short_description' => 'Unbelievably soft peach-skin velvet lamination with metallic foil accents.',
                    'description' => 'Crafted for executives, design agencies, and luxury brands. Features a tactile suede-feel velvet celloglaze with optional raised metallic foil stamping.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 4,
                    'base_price' => 69.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 90.00,
                    'height_mm' => 55.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Side', 'type' => 'front', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                    ['name' => 'Back Side', 'type' => 'back', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [
                    [
                        'name' => 'Foil Stamping',
                        'code' => 'foil_finish',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Velvet Touch Only (No Foil)', 'value' => 'none', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Gold Foil Stamping (Front)', 'value' => 'gold_foil_front', 'price_modifier_amount' => 55.00, 'sort_order' => 2],
                            ['label' => 'Silver Foil Stamping (Front)', 'value' => 'silver_foil_front', 'price_modifier_amount' => 55.00, 'sort_order' => 3],
                            ['label' => 'Rose Gold Foil (Front)', 'value' => 'rose_gold_front', 'price_modifier_amount' => 60.00, 'sort_order' => 4],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.38, 'setup' => 25.00],
                    ['qty' => 500, 'unit' => 0.29, 'setup' => 20.00],
                    ['qty' => 1000, 'unit' => 0.21, 'setup' => 15.00],
                    ['qty' => 2500, 'unit' => 0.15, 'setup' => 0.00],
                ]
            );

            // 3. Eco-Friendly Kraft Business Cards
            $this->seedProduct(
                category: $cardsCat,
                productData: [
                    'name' => 'Eco-Friendly Kraft Business Cards',
                    'slug' => 'eco-friendly-kraft-business-cards',
                    'sku' => 'BC-KRAFT-350',
                    'short_description' => 'Rustic 350gsm unbleached organic brown Kraft card with natural fibers.',
                    'description' => '100% recycled unbleached natural brown Kraft cardstock. Ideal for sustainable brands, cafes, artisan makers, and eco-conscious businesses.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 100,
                    'turnaround_days' => 2,
                    'base_price' => 35.00,
                    'is_active' => true,
                    'is_featured' => false,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 90.00,
                    'height_mm' => 55.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Side', 'type' => 'front', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                    ['name' => 'Back Side', 'type' => 'back', 'width_mm' => 90.00, 'height_mm' => 55.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [
                    [
                        'name' => 'Ink Style',
                        'code' => 'ink_style',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Solid Black & CMYK Inks', 'value' => 'cmyk_black', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Opaque White Ink Accent', 'value' => 'white_ink', 'price_modifier_amount' => 25.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 100, 'unit' => 0.45, 'setup' => 15.00],
                    ['qty' => 250, 'unit' => 0.28, 'setup' => 15.00],
                    ['qty' => 500, 'unit' => 0.20, 'setup' => 10.00],
                    ['qty' => 1000, 'unit' => 0.14, 'setup' => 0.00],
                ]
            );
        }

        // =========================================================================
        // CATEGORY 2: FLYERS & MARKETING
        // =========================================================================
        if ($flyersCat) {
            // 4. Gloss Marketing Flyers
            $this->seedProduct(
                category: $flyersCat,
                productData: [
                    'name' => 'Gloss Marketing Flyers',
                    'slug' => 'gloss-marketing-flyers',
                    'sku' => 'FLY-150-GLOSS',
                    'short_description' => 'Vibrant 150gsm gloss artpaper flyers ideal for letterbox drops and promotions.',
                    'description' => 'Full-colour commercial offset printing with rich vibrant inks on high-bulk 150gsm gloss art paper.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 2,
                    'base_price' => 59.00,
                    'sale_price' => 49.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 210.00,
                    'height_mm' => 297.00,
                    'margin_mm' => 4.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 4.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Page', 'type' => 'front', 'width_mm' => 210.00, 'height_mm' => 297.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 4.00],
                    ['name' => 'Back Page', 'type' => 'back', 'width_mm' => 210.00, 'height_mm' => 297.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 4.00],
                ],
                attributes: [
                    [
                        'name' => 'Finished Size',
                        'code' => 'size',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'A4 (210 x 297 mm)', 'value' => 'a4', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'A5 (148 x 210 mm)', 'value' => 'a5', 'price_modifier_type' => 'multiplier', 'price_modifier_amount' => 0.65, 'sort_order' => 2],
                            ['label' => 'DL (99 x 210 mm)', 'value' => 'dl', 'price_modifier_type' => 'multiplier', 'price_modifier_amount' => 0.50, 'sort_order' => 3],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.45, 'setup' => 25.00],
                    ['qty' => 500, 'unit' => 0.32, 'setup' => 25.00],
                    ['qty' => 1000, 'unit' => 0.22, 'setup' => 20.00],
                    ['qty' => 2500, 'unit' => 0.14, 'setup' => 0.00],
                    ['qty' => 5000, 'unit' => 0.09, 'setup' => 0.00],
                ]
            );

            // 5. DL Folded Brochures (Tri-Fold / 6-Panel)
            $this->seedProduct(
                category: $flyersCat,
                productData: [
                    'name' => 'DL Folded Brochures (Tri-Fold / 6-Panel)',
                    'slug' => 'dl-folded-brochures-tri-fold',
                    'sku' => 'BRC-TRI-150',
                    'short_description' => 'Flat A4 folded into 6-panel DL brochure. Essential for cafe menus and company profiles.',
                    'description' => 'Flat A4 (297x210 mm) scored and folded into sleek 6-panel DL format. Available in roll fold (C-fold) or accordion fold (Z-fold) on premium 150gsm gloss artpaper.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 3,
                    'base_price' => 95.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 297.00,
                    'height_mm' => 210.00,
                    'margin_mm' => 4.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 4.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1606836577743-f3f858d966ba?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1606836577743-f3f858d966ba?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Outer 3 Panels', 'type' => 'front', 'width_mm' => 297.00, 'height_mm' => 210.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 4.00],
                    ['name' => 'Inner 3 Panels', 'type' => 'back', 'width_mm' => 297.00, 'height_mm' => 210.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 4.00],
                ],
                attributes: [
                    [
                        'name' => 'Fold Style',
                        'code' => 'fold_style',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Roll Fold (C-Fold / Panels fold inwards)', 'value' => 'roll_c_fold', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Z-Fold (Concertina / Accordion style)', 'value' => 'z_fold', 'price_modifier_amount' => 0.00, 'sort_order' => 2],
                        ],
                    ],
                    [
                        'name' => 'Stock Weight',
                        'code' => 'paper_stock',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 2,
                        'values' => [
                            ['label' => '150gsm Gloss Artpaper (Standard)', 'value' => '150gsm_gloss', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '250gsm Silk Artboard (Scored Heavyweight)', 'value' => '250gsm_silk', 'price_modifier_amount' => 35.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.55, 'setup' => 25.00],
                    ['qty' => 500, 'unit' => 0.38, 'setup' => 25.00],
                    ['qty' => 1000, 'unit' => 0.26, 'setup' => 20.00],
                    ['qty' => 2500, 'unit' => 0.17, 'setup' => 0.00],
                    ['qty' => 5000, 'unit' => 0.12, 'setup' => 0.00],
                ]
            );

            // 6. A3 Vibrant Artpaper Posters
            $this->seedProduct(
                category: $flyersCat,
                productData: [
                    'name' => 'A3 Vibrant Artpaper Posters (297 x 420mm)',
                    'slug' => 'a3-artpaper-posters',
                    'sku' => 'PST-A3-GLOSS',
                    'short_description' => 'High-resolution full-colour A3 posters for window displays, gigs, and retail sales.',
                    'description' => 'Crisp high-definition print on heavy 200gsm gloss or satin artpaper. Brings imagery to life with eye-catching richness and contrast.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 25,
                    'turnaround_days' => 2,
                    'base_price' => 49.00,
                    'is_active' => true,
                    'is_featured' => false,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 297.00,
                    'height_mm' => 420.00,
                    'margin_mm' => 5.00,
                    'bleed_mm' => 3.00,
                    'safe_area_mm' => 5.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Poster', 'type' => 'front', 'width_mm' => 297.00, 'height_mm' => 420.00, 'bleed_mm' => 3.00, 'safe_zone_mm' => 5.00],
                ],
                attributes: [
                    [
                        'name' => 'Paper Stock',
                        'code' => 'paper_stock',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => '200gsm Gloss Artpaper (Vibrant)', 'value' => '200gsm_gloss', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '250gsm Satin Matte (Low Glare)', 'value' => '250gsm_satin', 'price_modifier_amount' => 10.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 25, 'unit' => 2.20, 'setup' => 15.00],
                    ['qty' => 50, 'unit' => 1.60, 'setup' => 15.00],
                    ['qty' => 100, 'unit' => 1.10, 'setup' => 10.00],
                    ['qty' => 250, 'unit' => 0.75, 'setup' => 0.00],
                    ['qty' => 500, 'unit' => 0.50, 'setup' => 0.00],
                ]
            );

            // 7. Heavyweight Promotional Postcards (A6)
            $this->seedProduct(
                category: $flyersCat,
                productData: [
                    'name' => 'Heavyweight Promotional Postcards (A6)',
                    'slug' => 'heavyweight-promotional-postcards-a6',
                    'sku' => 'POST-A6-350',
                    'short_description' => 'Sturdy 350gsm silk board postcards with gloss front and writable uncoated back.',
                    'description' => 'A6 format (105x148 mm). Perfect for direct mail campaigns, package thank you cards, and promo vouchers with pen-writable reverse.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 100,
                    'turnaround_days' => 2,
                    'base_price' => 39.00,
                    'is_active' => true,
                    'is_featured' => false,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 148.00,
                    'height_mm' => 105.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1572945753423-f77ff45a29a2?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1572945753423-f77ff45a29a2?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Artwork', 'type' => 'front', 'width_mm' => 148.00, 'height_mm' => 105.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                    ['name' => 'Back Side', 'type' => 'back', 'width_mm' => 148.00, 'height_mm' => 105.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [
                    [
                        'name' => 'Front Coating',
                        'code' => 'coating',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'High Gloss Celloglaze Front', 'value' => 'gloss_front', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Velvety Matt Celloglaze Front', 'value' => 'matt_front', 'price_modifier_amount' => 8.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 100, 'unit' => 0.39, 'setup' => 15.00],
                    ['qty' => 250, 'unit' => 0.24, 'setup' => 15.00],
                    ['qty' => 500, 'unit' => 0.16, 'setup' => 10.00],
                    ['qty' => 1000, 'unit' => 0.11, 'setup' => 0.00],
                    ['qty' => 2500, 'unit' => 0.08, 'setup' => 0.00],
                ]
            );
        }

        // =========================================================================
        // CATEGORY 3: SIGNAGE & BANNERS
        // =========================================================================
        if ($signageCat) {
            // 8. Standard Pull-Up Banner (850 x 2000mm)
            $this->seedProduct(
                category: $signageCat,
                productData: [
                    'name' => 'Standard Pull-Up Banner (850 x 2000mm)',
                    'slug' => 'pull-up-banner-standard',
                    'sku' => 'BAN-850-STD',
                    'short_description' => 'Portable trade show banner with heavy aluminium base and padded carry bag.',
                    'description' => 'Printed high-resolution on anti-curl satin blockout polypropylene film for crisp graphics and zero transparency.',
                    'product_type' => ProductType::SIGNAGE,
                    'min_quantity' => 1,
                    'turnaround_days' => 2,
                    'base_price' => 125.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 850.00,
                    'height_mm' => 2000.00,
                    'margin_mm' => 10.00,
                    'bleed_mm' => 5.00,
                    'safe_area_mm' => 10.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Banner Face', 'type' => 'front', 'width_mm' => 850.00, 'height_mm' => 2000.00, 'bleed_mm' => 5.00, 'safe_zone_mm' => 10.00],
                ],
                attributes: [],
                quantityBreaks: [
                    ['qty' => 1, 'unit' => 125.00, 'setup' => 0.00],
                    ['qty' => 2, 'unit' => 110.00, 'setup' => 0.00],
                    ['qty' => 5, 'unit' => 95.00, 'setup' => 0.00],
                    ['qty' => 10, 'unit' => 85.00, 'setup' => 0.00],
                ]
            );

            // 9. Outdoor Weatherproof Corflute Signs (600 x 900mm)
            $this->seedProduct(
                category: $signageCat,
                productData: [
                    'name' => 'Outdoor Weatherproof Corflute Signs (600 x 900mm)',
                    'slug' => 'corflute-signs-600x900',
                    'sku' => 'SGN-CORF-600900',
                    'short_description' => 'Lightweight 5mm white ribbed corflute board with UV weather-resistant inks.',
                    'description' => 'Direct flatbed UV printed on durable 5mm fluted plastic. The standard format for Australian real estate boards, construction sites, and election signage.',
                    'product_type' => ProductType::SIGNAGE,
                    'min_quantity' => 1,
                    'turnaround_days' => 2,
                    'base_price' => 38.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 600.00,
                    'height_mm' => 900.00,
                    'margin_mm' => 15.00,
                    'bleed_mm' => 5.00,
                    'safe_area_mm' => 15.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Face', 'type' => 'front', 'width_mm' => 600.00, 'height_mm' => 900.00, 'bleed_mm' => 5.00, 'safe_zone_mm' => 15.00],
                ],
                attributes: [
                    [
                        'name' => 'Eyelets & Finishing',
                        'code' => 'eyelets',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Clean Cut (No Eyelets)', 'value' => 'none', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '4 Corner Brass Eyelets', 'value' => '4_corners', 'price_modifier_amount' => 6.00, 'sort_order' => 2],
                            ['label' => 'Eyelets Every 500mm Around Edge', 'value' => 'every_500mm', 'price_modifier_amount' => 12.00, 'sort_order' => 3],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 1, 'unit' => 38.00, 'setup' => 0.00],
                    ['qty' => 2, 'unit' => 32.00, 'setup' => 0.00],
                    ['qty' => 5, 'unit' => 26.00, 'setup' => 0.00],
                    ['qty' => 10, 'unit' => 21.00, 'setup' => 0.00],
                    ['qty' => 25, 'unit' => 17.50, 'setup' => 0.00],
                    ['qty' => 50, 'unit' => 14.00, 'setup' => 0.00],
                ]
            );

            // 10. Heavy-Duty PVC Vinyl Banners
            $this->seedProduct(
                category: $signageCat,
                productData: [
                    'name' => 'Outdoor Heavy-Duty PVC Vinyl Banners (2000 x 1000mm)',
                    'slug' => 'outdoor-pvc-vinyl-banners',
                    'sku' => 'BAN-VINYL-2X1',
                    'short_description' => 'Reinforced 450gsm outdoor PVC banner with welded hems and metal eyelets.',
                    'description' => 'Tough, tear-resistant PVC banners crafted for fence lines, building wraps, sporting clubs, and promotions. UV waterproof inks for long-term outdoor brilliance.',
                    'product_type' => ProductType::SIGNAGE,
                    'min_quantity' => 1,
                    'turnaround_days' => 2,
                    'base_price' => 89.00,
                    'is_active' => true,
                    'is_featured' => false,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 2000.00,
                    'height_mm' => 1000.00,
                    'margin_mm' => 25.00,
                    'bleed_mm' => 10.00,
                    'safe_area_mm' => 25.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Banner Face', 'type' => 'front', 'width_mm' => 2000.00, 'height_mm' => 1000.00, 'bleed_mm' => 10.00, 'safe_zone_mm' => 25.00],
                ],
                attributes: [
                    [
                        'name' => 'Finishing Style',
                        'code' => 'banner_finishing',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Welded Hem + Eyelets Every 500mm', 'value' => 'welded_hem_eyelets', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Clean Cut Edges (No Eyelets)', 'value' => 'clean_cut', 'price_modifier_amount' => -10.00, 'sort_order' => 2],
                            ['label' => 'Pole Pockets Top & Bottom', 'value' => 'pole_pockets', 'price_modifier_amount' => 18.00, 'sort_order' => 3],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 1, 'unit' => 89.00, 'setup' => 0.00],
                    ['qty' => 2, 'unit' => 79.00, 'setup' => 0.00],
                    ['qty' => 5, 'unit' => 68.00, 'setup' => 0.00],
                    ['qty' => 10, 'unit' => 59.00, 'setup' => 0.00],
                ]
            );

            // 11. Metal A-Frame Signs (600 x 900mm)
            $this->seedProduct(
                category: $signageCat,
                productData: [
                    'name' => 'Metal A-Frame Signs (600 x 900mm)',
                    'slug' => 'metal-a-frame-signs',
                    'sku' => 'SGN-AFRAME-600',
                    'short_description' => 'Heavy-duty black powder-coated steel A-frame with 2 full-colour metal faces.',
                    'description' => 'Durable outdoor footpath sandwich board. Fitted with two weatherproof UV laminated Colorbond signboards, carry handle, and non-slip rubber feet.',
                    'product_type' => ProductType::SIGNAGE,
                    'min_quantity' => 1,
                    'turnaround_days' => 3,
                    'base_price' => 189.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 600.00,
                    'height_mm' => 900.00,
                    'margin_mm' => 15.00,
                    'bleed_mm' => 5.00,
                    'safe_area_mm' => 15.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Side A (Street View)', 'type' => 'front', 'width_mm' => 600.00, 'height_mm' => 900.00, 'bleed_mm' => 5.00, 'safe_zone_mm' => 15.00],
                    ['name' => 'Side B (Footpath View)', 'type' => 'back', 'width_mm' => 600.00, 'height_mm' => 900.00, 'bleed_mm' => 5.00, 'safe_zone_mm' => 15.00],
                ],
                attributes: [
                    [
                        'name' => 'Kit Selection',
                        'code' => 'kit_option',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Complete Frame + 2 Printed Faces', 'value' => 'complete_kit', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Replacement Printed Panels Only (Pair)', 'value' => 'panels_only', 'price_modifier_amount' => -60.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 1, 'unit' => 189.00, 'setup' => 0.00],
                    ['qty' => 2, 'unit' => 169.00, 'setup' => 0.00],
                    ['qty' => 5, 'unit' => 149.00, 'setup' => 0.00],
                ]
            );
        }

        // =========================================================================
        // CATEGORY 4: STICKERS & LABELS
        // =========================================================================
        if ($stickersCat) {
            // 12. Custom Die-Cut Vinyl Stickers
            $this->seedProduct(
                category: $stickersCat,
                productData: [
                    'name' => 'Custom Die-Cut Vinyl Stickers',
                    'slug' => 'custom-die-cut-vinyl-stickers',
                    'sku' => 'STK-DIECUT-VINYL',
                    'short_description' => 'Precision contour-cut individual stickers on heavy waterproof vinyl.',
                    'description' => 'Cut precisely around the contour of your design. Printed on high-grade 100µm monomeric vinyl with UV barrier laminate for dishwashers, cars, and laptops.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 50,
                    'turnaround_days' => 2,
                    'base_price' => 35.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 75.00,
                    'height_mm' => 75.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Sticker Face', 'type' => 'front', 'width_mm' => 75.00, 'height_mm' => 75.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [
                    [
                        'name' => 'Sticker Finish',
                        'code' => 'sticker_finish',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'High Gloss Vinyl (Laminated)', 'value' => 'gloss_vinyl', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Smooth Matte Vinyl (Laminated)', 'value' => 'matte_vinyl', 'price_modifier_amount' => 0.00, 'sort_order' => 2],
                            ['label' => 'Holographic Rainbow Foil', 'value' => 'holographic', 'price_modifier_amount' => 25.00, 'sort_order' => 3],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 50, 'unit' => 0.85, 'setup' => 15.00],
                    ['qty' => 100, 'unit' => 0.55, 'setup' => 15.00],
                    ['qty' => 250, 'unit' => 0.32, 'setup' => 10.00],
                    ['qty' => 500, 'unit' => 0.22, 'setup' => 0.00],
                    ['qty' => 1000, 'unit' => 0.15, 'setup' => 0.00],
                ]
            );

            // 13. Gloss Product Packaging Roll Labels
            $this->seedProduct(
                category: $stickersCat,
                productData: [
                    'name' => 'Gloss Product Packaging Roll Labels',
                    'slug' => 'product-packaging-roll-labels',
                    'sku' => 'LBL-ROLL-GLOSS',
                    'short_description' => 'Machine-ready roll labels for beverage bottles, cosmetic jars, and candle boxes.',
                    'description' => 'Supplied on convenient cardboard cores ready for machine applicators or fast hand labeling. Smudge-proof gloss BOPP synthetic material with permanent adhesive.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 250,
                    'turnaround_days' => 3,
                    'base_price' => 75.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 50.00,
                    'height_mm' => 50.00,
                    'margin_mm' => 2.50,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 2.50,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Label Face', 'type' => 'front', 'width_mm' => 50.00, 'height_mm' => 50.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 2.50],
                ],
                attributes: [
                    [
                        'name' => 'Shape & Size',
                        'code' => 'label_shape',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => '50mm Circle', 'value' => '50mm_circle', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '40mm Circle', 'value' => '40mm_circle', 'price_modifier_amount' => -10.00, 'sort_order' => 2],
                            ['label' => '75 x 50mm Rectangle', 'value' => '75x50_rect', 'price_modifier_amount' => 15.00, 'sort_order' => 3],
                        ],
                    ],
                    [
                        'name' => 'Material Type',
                        'code' => 'label_material',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 2,
                        'values' => [
                            ['label' => 'Gloss White BOPP (Waterproof)', 'value' => 'gloss_bopp', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Clear Transparent Synthetic', 'value' => 'clear_bopp', 'price_modifier_amount' => 20.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.35, 'setup' => 20.00],
                    ['qty' => 500, 'unit' => 0.22, 'setup' => 20.00],
                    ['qty' => 1000, 'unit' => 0.14, 'setup' => 15.00],
                    ['qty' => 2500, 'unit' => 0.08, 'setup' => 0.00],
                    ['qty' => 5000, 'unit' => 0.05, 'setup' => 0.00],
                ]
            );

            // 14. Outdoor Bumper & Window Vinyl Decals
            $this->seedProduct(
                category: $stickersCat,
                productData: [
                    'name' => 'Outdoor Bumper & Window Vinyl Decals',
                    'slug' => 'outdoor-bumper-window-decals',
                    'sku' => 'STK-DEC-BUMP',
                    'short_description' => 'Weatherproof bumper stickers with 3-5 year outdoor UV lamination.',
                    'description' => 'Commercial automotive monomeric vinyl for vehicles, sports equipment, and outdoor gear. Easy to apply with bubble-free adhesive backing.',
                    'product_type' => ProductType::STANDARD_PRINT,
                    'min_quantity' => 50,
                    'turnaround_days' => 2,
                    'base_price' => 45.00,
                    'is_active' => true,
                    'is_featured' => false,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 210.00,
                    'height_mm' => 75.00,
                    'margin_mm' => 3.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 3.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Decal Face', 'type' => 'front', 'width_mm' => 210.00, 'height_mm' => 75.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 3.00],
                ],
                attributes: [],
                quantityBreaks: [
                    ['qty' => 50, 'unit' => 1.10, 'setup' => 15.00],
                    ['qty' => 100, 'unit' => 0.85, 'setup' => 15.00],
                    ['qty' => 250, 'unit' => 0.58, 'setup' => 10.00],
                    ['qty' => 500, 'unit' => 0.42, 'setup' => 0.00],
                    ['qty' => 1000, 'unit' => 0.32, 'setup' => 0.00],
                ]
            );
        }

        // =========================================================================
        // CATEGORY 5: STATIONERY & BOOKLETS
        // =========================================================================
        if ($stationeryCat) {
            // 15. Corporate A4 Letterheads
            $this->seedProduct(
                category: $stationeryCat,
                productData: [
                    'name' => 'Corporate A4 Letterheads (Laser Guaranteed)',
                    'slug' => 'corporate-a4-letterheads',
                    'sku' => 'STAT-LTHD-A4',
                    'short_description' => 'Crisp 100gsm laser-safe bond letterhead paper for professional correspondence.',
                    'description' => 'Premium high-white uncoated bond designed specifically to run smoothly through all desktop laser and inkjet office printers without jamming or ink ghosting.',
                    'product_type' => ProductType::STATIONERY,
                    'min_quantity' => 250,
                    'turnaround_days' => 2,
                    'base_price' => 65.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'front',
                    'width_mm' => 210.00,
                    'height_mm' => 297.00,
                    'margin_mm' => 5.00,
                    'bleed_mm' => 2.00,
                    'safe_area_mm' => 5.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Side', 'type' => 'front', 'width_mm' => 210.00, 'height_mm' => 297.00, 'bleed_mm' => 2.00, 'safe_zone_mm' => 5.00],
                ],
                attributes: [
                    [
                        'name' => 'Paper Stock',
                        'code' => 'stock_weight',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => '100gsm Premium Laser White Bond', 'value' => '100gsm_bond', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '120gsm Luxury Ultra-Smooth Laser', 'value' => '120gsm_smooth', 'price_modifier_amount' => 22.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 250, 'unit' => 0.32, 'setup' => 20.00],
                    ['qty' => 500, 'unit' => 0.21, 'setup' => 20.00],
                    ['qty' => 1000, 'unit' => 0.13, 'setup' => 15.00],
                    ['qty' => 2500, 'unit' => 0.085, 'setup' => 0.00],
                    ['qty' => 5000, 'unit' => 0.065, 'setup' => 0.00],
                ]
            );

            // 16. Interlocking Presentation Folders (A4 Oversized)
            $this->seedProduct(
                category: $stationeryCat,
                productData: [
                    'name' => 'Interlocking Presentation Folders (A4 Oversized)',
                    'slug' => 'interlocking-presentation-folders-a4',
                    'sku' => 'STAT-FOLD-A4',
                    'short_description' => 'Heavy 350gsm presentation folders with die-cut pocket and business card slots.',
                    'description' => 'Holds proposals, contracts, brochures, and quotes in clean executive style. Features an interlocking bottom pocket with dual business card slits.',
                    'product_type' => ProductType::STATIONERY,
                    'min_quantity' => 100,
                    'turnaround_days' => 4,
                    'base_price' => 195.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'both',
                    'width_mm' => 220.00,
                    'height_mm' => 310.00,
                    'margin_mm' => 6.00,
                    'bleed_mm' => 3.00,
                    'safe_area_mm' => 6.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Outside Covers', 'type' => 'front', 'width_mm' => 220.00, 'height_mm' => 310.00, 'bleed_mm' => 3.00, 'safe_zone_mm' => 6.00],
                    ['name' => 'Inside Covers', 'type' => 'back', 'width_mm' => 220.00, 'height_mm' => 310.00, 'bleed_mm' => 3.00, 'safe_zone_mm' => 6.00],
                ],
                attributes: [
                    [
                        'name' => 'Protective Finish',
                        'code' => 'folder_finish',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => 'Matt Celloglaze Outer', 'value' => 'matt_outer', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Gloss Celloglaze Outer', 'value' => 'gloss_outer', 'price_modifier_amount' => 0.00, 'sort_order' => 2],
                            ['label' => 'Matt Both Sides + Spot UV Logo', 'value' => 'spot_uv_logo', 'price_modifier_amount' => 75.00, 'sort_order' => 3],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 100, 'unit' => 2.40, 'setup' => 45.00],
                    ['qty' => 250, 'unit' => 1.70, 'setup' => 35.00],
                    ['qty' => 500, 'unit' => 1.25, 'setup' => 25.00],
                    ['qty' => 1000, 'unit' => 0.95, 'setup' => 0.00],
                    ['qty' => 2500, 'unit' => 0.75, 'setup' => 0.00],
                ]
            );

            // 17. Saddle-Stitched Multi-Page Booklets (A4)
            $this->seedProduct(
                category: $stationeryCat,
                productData: [
                    'name' => 'Saddle-Stitched Multi-Page Booklets (A4)',
                    'slug' => 'saddle-stitched-booklets-a4',
                    'sku' => 'BKL-SADDLE-A4',
                    'short_description' => 'Staple wire-bound booklets and magazines on high-opacity gloss artpaper.',
                    'description' => 'Professional multi-page booklets folded and saddle-stitched with dual wire staples. Ideal for annual company reports, service guides, and retail catalogues.',
                    'product_type' => ProductType::STATIONERY,
                    'min_quantity' => 50,
                    'turnaround_days' => 4,
                    'base_price' => 145.00,
                    'is_active' => true,
                    'is_featured' => true,
                    'allow_custom_design' => true,
                    'allow_customer_upload' => true,
                    'status' => 'published',
                    'print_sides' => 'multi',
                    'width_mm' => 210.00,
                    'height_mm' => 297.00,
                    'margin_mm' => 5.00,
                    'bleed_mm' => 3.00,
                    'safe_area_mm' => 5.00,
                    'featured_image_url' => 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
                    'gallery_images' => [
                        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
                    ],
                ],
                sides: [
                    ['name' => 'Front Cover', 'type' => 'front', 'width_mm' => 210.00, 'height_mm' => 297.00, 'bleed_mm' => 3.00, 'safe_zone_mm' => 5.00],
                    ['name' => 'Back Cover', 'type' => 'back', 'width_mm' => 210.00, 'height_mm' => 297.00, 'bleed_mm' => 3.00, 'safe_zone_mm' => 5.00],
                ],
                attributes: [
                    [
                        'name' => 'Page Count (Including Cover)',
                        'code' => 'page_count',
                        'type' => 'select',
                        'is_required' => true,
                        'sort_order' => 1,
                        'values' => [
                            ['label' => '8 Pages', 'value' => '8_pages', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => '12 Pages', 'value' => '12_pages', 'price_modifier_amount' => 45.00, 'sort_order' => 2],
                            ['label' => '16 Pages', 'value' => '16_pages', 'price_modifier_amount' => 85.00, 'sort_order' => 3],
                            ['label' => '24 Pages', 'value' => '24_pages', 'price_modifier_amount' => 150.00, 'sort_order' => 4],
                        ],
                    ],
                    [
                        'name' => 'Cover Weight',
                        'code' => 'cover_type',
                        'type' => 'radio',
                        'is_required' => true,
                        'sort_order' => 2,
                        'values' => [
                            ['label' => 'Self-Cover (All 150gsm Gloss)', 'value' => 'self_cover', 'price_modifier_amount' => 0.00, 'sort_order' => 1],
                            ['label' => 'Heavy 250gsm Matt Laminated Cover', 'value' => 'heavy_cover', 'price_modifier_amount' => 35.00, 'sort_order' => 2],
                        ],
                    ],
                ],
                quantityBreaks: [
                    ['qty' => 50, 'unit' => 3.20, 'setup' => 40.00],
                    ['qty' => 100, 'unit' => 2.10, 'setup' => 35.00],
                    ['qty' => 250, 'unit' => 1.45, 'setup' => 25.00],
                    ['qty' => 500, 'unit' => 1.05, 'setup' => 0.00],
                    ['qty' => 1000, 'unit' => 0.78, 'setup' => 0.00],
                ]
            );
        }
    }

    /**
     * Helper to seed a complete product with sides, print areas, attributes, and quantity breaks.
     */
    protected function seedProduct(
        Category $category,
        array $productData,
        array $sides,
        array $attributes = [],
        array $quantityBreaks = []
    ): Product {
        $slug = $productData['slug'];
        $product = Product::updateOrCreate(
            ['slug' => $slug],
            array_merge($productData, ['category_id' => $category->id])
        );

        // Sync with category pivot table
        $product->categories()->syncWithoutDetaching([$category->id]);

        // Seed Sides & Print Areas
        $sideIndex = 1;
        foreach ($sides as $s) {
            $sideModel = ProductSide::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'side_number' => $sideIndex,
                ],
                [
                    'name' => $s['name'],
                    'type' => $s['type'] ?? ($sideIndex === 1 ? 'front' : 'back'),
                    'sort_order' => $sideIndex,
                    'is_active' => true,
                ]
            );

            ProductPrintArea::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'name' => $s['name'],
                ],
                [
                    'product_side_id' => $sideModel->id,
                    'side' => $s['type'] ?? ($sideIndex === 1 ? 'front' : 'back'),
                    'width_mm' => $s['width_mm'],
                    'height_mm' => $s['height_mm'],
                    'bleed_mm' => $s['bleed_mm'] ?? 2.00,
                    'safe_zone_mm' => $s['safe_zone_mm'] ?? 3.00,
                    'cut_line_color' => '#FF0000',
                ]
            );

            $sideIndex++;
        }

        // Seed Attributes and Attribute Values
        foreach ($attributes as $attr) {
            $attrModel = ProductAttribute::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'code' => $attr['code'],
                ],
                [
                    'name' => $attr['name'],
                    'type' => $attr['type'],
                    'is_required' => $attr['is_required'] ?? false,
                    'sort_order' => $attr['sort_order'] ?? 1,
                ]
            );

            if (!empty($attr['values'])) {
                foreach ($attr['values'] as $val) {
                    ProductAttributeValue::updateOrCreate(
                        [
                            'product_attribute_id' => $attrModel->id,
                            'value' => $val['value'],
                        ],
                        [
                            'label' => $val['label'],
                            'price_modifier_type' => $val['price_modifier_type'] ?? 'fixed',
                            'price_modifier_amount' => $val['price_modifier_amount'] ?? 0.00,
                            'sort_order' => $val['sort_order'] ?? 1,
                        ]
                    );
                }
            }
        }

        // Seed Tiered Pricing Matrices
        if (!empty($quantityBreaks)) {
            $baseUnit = $quantityBreaks[0]['unit'] ?? 1.0;
            foreach ($quantityBreaks as $qb) {
                $unit = (float) $qb['unit'];
                $discount = $baseUnit > 0 ? round((1 - ($unit / $baseUnit)) * 100, 2) : 0.0;
                if ($discount < 0) {
                    $discount = 0.0;
                }

                PricingMatrix::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'quantity' => $qb['qty'],
                    ],
                    [
                        'unit_price_ex_gst' => $unit,
                        'setup_fee' => (float) ($qb['setup'] ?? 0.00),
                        'discount_percentage' => $discount,
                    ]
                );
            }
        }

        return $product;
    }
}
