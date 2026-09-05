<?php

namespace Database\Seeders;

use App\Enums\ProductType;
use App\Models\Category;
use App\Models\DesignAsset;
use App\Models\DesignAssetCategory;
use App\Models\DesignTemplate;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductPrintArea;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminDemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // =========================================================================
        // 1. ADMIN USER ACCOUNTS
        // =========================================================================
        $primaryAdmin = User::updateOrCreate(
            ['email' => 'admin@printecommerce.com.au'],
            [
                'name' => 'Print Operations Admin',
                'phone' => '1300 000 789',
                'company_name' => 'Print Ecommerce Pty Ltd',
                'abn' => '12345678901',
                'role' => 'admin',
                'password' => Hash::make('SecretAdmin2026!'),
                'email_verified_at' => now(),
            ]
        );

        $simpleAdmin = User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Administrator',
                'phone' => '0400 000 000',
                'company_name' => 'Print Admin Portal',
                'role' => 'admin',
                'password' => Hash::make('admin123'),
                'email_verified_at' => now(),
            ]
        );

        // =========================================================================
        // 2. PRODUCT CATEGORIES
        // =========================================================================
        $catCards = Category::updateOrCreate(
            ['slug' => 'business-cards'],
            [
                'name' => 'Business Cards',
                'description' => 'Premium, luxury, and eco-friendly business cards crafted on heavy stocks.',
                'image_url' => '/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                'sort_order' => 1,
                'is_active' => true,
            ]
        );

        $catFlyers = Category::updateOrCreate(
            ['slug' => 'flyers-marketing'],
            [
                'name' => 'Flyers & Marketing',
                'description' => 'High-impact promotional flyers, brochures, folded menus, and postcards.',
                'image_url' => '/storage/products/GrDOgaqMkfvoaWBhsjKKV5I6sUiE6glie1XBCDki.jpg',
                'sort_order' => 2,
                'is_active' => true,
            ]
        );

        $catStickers = Category::updateOrCreate(
            ['slug' => 'stickers-labels'],
            [
                'name' => 'Stickers & Labels',
                'description' => 'Custom die-cut vinyl stickers, sheet labels, and product packaging seals.',
                'image_url' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                'sort_order' => 3,
                'is_active' => true,
            ]
        );

        // =========================================================================
        // 3. THREE PRODUCTS WITH IMAGES AND PRINT DIMENSIONS
        // =========================================================================

        // PRODUCT 1: Premium Matte Business Cards (Double-Sided)
        $prodCards = Product::updateOrCreate(
            ['slug' => 'premium-matte-business-cards'],
            [
                'category_id' => $catCards->id,
                'name' => 'Premium Matte Business Cards',
                'sku' => 'BC-MATTE-9050',
                'product_type' => ProductType::STANDARD_PRINT,
                'short_description' => 'Ultra-thick 450gsm luxury business cards with smooth velvet matte celloglaze.',
                'description' => 'Standard Australian commercial format (90×50 mm) featuring dual-sided precision print, 3mm bleed margin, and optional spot gloss accents.',
                'min_quantity' => 100,
                'turnaround_days' => 2,
                'base_price' => 29.00,
                'sale_price' => 24.50,
                'featured_image_url' => '/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                'gallery_images' => [
                    '/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                    '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                ],
                'is_active' => true,
                'is_featured' => true,
                'allow_custom_design' => true,
                'allow_customer_upload' => true,
                'status' => 'published',
                // New Print Settings
                'print_sides' => 'both',
                'width_mm' => 90.00,
                'height_mm' => 50.00,
                'margin_mm' => 3.00,
                'bleed_mm' => 3.00,
                'safe_area_mm' => 3.00,
            ]
        );

        ProductPrintArea::updateOrCreate(
            ['product_id' => $prodCards->id, 'name' => 'Front Side'],
            [
                'width_mm' => 90.00,
                'height_mm' => 50.00,
                'bleed_mm' => 3.00,
                'safe_zone_mm' => 3.00,
                'cut_line_color' => '#000000',
            ]
        );
        ProductPrintArea::updateOrCreate(
            ['product_id' => $prodCards->id, 'name' => 'Back Side'],
            [
                'width_mm' => 90.00,
                'height_mm' => 50.00,
                'bleed_mm' => 3.00,
                'safe_zone_mm' => 3.00,
                'cut_line_color' => '#000000',
            ]
        );

        // PRODUCT 2: Gloss Promotional Flyers (A5) (Double-Sided)
        $prodFlyers = Product::updateOrCreate(
            ['slug' => 'gloss-promotional-flyers-a5'],
            [
                'category_id' => $catFlyers->id,
                'name' => 'Gloss Promotional Flyers (A5)',
                'sku' => 'FLY-A5-GLOSS',
                'product_type' => ProductType::STANDARD_PRINT,
                'short_description' => 'Vibrant 150gsm gloss artpaper flyers for marketing events, menus, and promotions.',
                'description' => 'Crisp digital offset printing on standard A5 (148×210 mm) format with high-gloss coating that brings photography and graphics to life.',
                'min_quantity' => 250,
                'turnaround_days' => 3,
                'base_price' => 59.00,
                'sale_price' => 49.00,
                'featured_image_url' => '/storage/products/GrDOgaqMkfvoaWBhsjKKV5I6sUiE6glie1XBCDki.jpg',
                'gallery_images' => [
                    '/storage/products/GrDOgaqMkfvoaWBhsjKKV5I6sUiE6glie1XBCDki.jpg',
                    '/storage/products/8QivKeT2ZrL2YAQk0ESThOVYZrrc0TVuMXIA1ZGZ.png',
                ],
                'is_active' => true,
                'is_featured' => true,
                'allow_custom_design' => true,
                'allow_customer_upload' => true,
                'status' => 'published',
                // New Print Settings
                'print_sides' => 'both',
                'width_mm' => 148.00,
                'height_mm' => 210.00,
                'margin_mm' => 4.00,
                'bleed_mm' => 3.00,
                'safe_area_mm' => 4.00,
            ]
        );

        ProductPrintArea::updateOrCreate(
            ['product_id' => $prodFlyers->id, 'name' => 'Front Side'],
            [
                'width_mm' => 148.00,
                'height_mm' => 210.00,
                'bleed_mm' => 3.00,
                'safe_zone_mm' => 4.00,
                'cut_line_color' => '#000000',
            ]
        );
        ProductPrintArea::updateOrCreate(
            ['product_id' => $prodFlyers->id, 'name' => 'Back Side'],
            [
                'width_mm' => 148.00,
                'height_mm' => 210.00,
                'bleed_mm' => 3.00,
                'safe_zone_mm' => 4.00,
                'cut_line_color' => '#000000',
            ]
        );

        // PRODUCT 3: Waterproof Custom Vinyl Stickers (Front-Only)
        $prodStickers = Product::updateOrCreate(
            ['slug' => 'waterproof-custom-vinyl-stickers'],
            [
                'category_id' => $catStickers->id,
                'name' => 'Waterproof Custom Vinyl Stickers',
                'sku' => 'STK-VINYL-100',
                'product_type' => ProductType::STANDARD_PRINT,
                'short_description' => 'Heavy-duty weather-resistant circular vinyl stickers with permanent adhesive.',
                'description' => '100×100 mm die-cut sticker format rated for indoor and outdoor use. Waterproof, UV-resistant, and scratch-proof.',
                'min_quantity' => 50,
                'turnaround_days' => 2,
                'base_price' => 35.00,
                'featured_image_url' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                'gallery_images' => [
                    '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                ],
                'is_active' => true,
                'is_featured' => true,
                'allow_custom_design' => true,
                'allow_customer_upload' => true,
                'status' => 'published',
                // New Print Settings
                'print_sides' => 'front',
                'width_mm' => 100.00,
                'height_mm' => 100.00,
                'margin_mm' => 3.00,
                'bleed_mm' => 2.00,
                'safe_area_mm' => 3.00,
            ]
        );

        ProductPrintArea::updateOrCreate(
            ['product_id' => $prodStickers->id, 'name' => 'Front Side'],
            [
                'width_mm' => 100.00,
                'height_mm' => 100.00,
                'bleed_mm' => 2.00,
                'safe_zone_mm' => 3.00,
                'cut_line_color' => '#000000',
            ]
        );

        // =========================================================================
        // 4. DESIGN TEMPLATES (USING IMAGES, TEXT, SHAPES - FRONT & BACK)
        // =========================================================================

        // TEMPLATE 1: Modern Executive Dual Business Card
        $frontCardJson = [
            'version' => '6.0.0',
            'background' => '#0f172a',
            'objects' => [
                [
                    'type' => 'Rect',
                    'left' => 30,
                    'top' => 30,
                    'width' => 1003,
                    'height' => 531,
                    'fill' => '#1e293b',
                    'rx' => 8,
                    'ry' => 8,
                ],
                [
                    'type' => 'Image',
                    'src' => '/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                    'left' => 70,
                    'top' => 70,
                    'width' => 300,
                    'height' => 200,
                    'scaleX' => 0.65,
                    'scaleY' => 0.65,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'Alexander Smith',
                    'fontSize' => 32,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#ffffff',
                    'left' => 300,
                    'top' => 85,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'Managing Director & Partner',
                    'fontSize' => 18,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#38bdf8',
                    'left' => 300,
                    'top' => 135,
                ],
                [
                    'type' => 'Textbox',
                    'text' => "+61 2 8000 9999   |   alexander@apexcreative.com.au\nLevel 28, 100 Barangaroo Avenue, Sydney NSW 2000\nwww.apexcreative.com.au",
                    'fontSize' => 15,
                    'fontFamily' => 'Inter',
                    'lineHeight' => 1.5,
                    'fill' => '#94a3b8',
                    'left' => 70,
                    'top' => 320,
                ],
            ],
        ];

        $backCardJson = [
            'version' => '6.0.0',
            'background' => '#0284c7',
            'objects' => [
                [
                    'type' => 'Image',
                    'src' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                    'left' => 380,
                    'top' => 120,
                    'width' => 250,
                    'height' => 250,
                    'scaleX' => 0.8,
                    'scaleY' => 0.8,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'APEX CREATIVE STUDIO',
                    'fontSize' => 28,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'charSpacing' => 150,
                    'textAlign' => 'center',
                    'fill' => '#ffffff',
                    'left' => 310,
                    'top' => 360,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'STRATEGY • DESIGN • DIGITAL',
                    'fontSize' => 14,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'charSpacing' => 200,
                    'textAlign' => 'center',
                    'fill' => '#bae6fd',
                    'left' => 365,
                    'top' => 410,
                ],
            ],
        ];

        DesignTemplate::updateOrCreate(
            ['name' => 'Executive Dual-Sided Business Card'],
            [
                'product_id' => $prodCards->id,
                'category' => 'Corporate',
                'is_active' => true,
                'thumbnail_url' => '/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                'print_sides' => 'both',
                'width_mm' => 90.00,
                'height_mm' => 50.00,
                'margin_mm' => 3.00,
                'bleed_mm' => 3.00,
                'safe_area_mm' => 3.00,
                'canvas_json' => $frontCardJson,
                'back_canvas_json' => $backCardJson,
                'artwork_config' => [
                    'width' => 90,
                    'height' => 50,
                    'unit' => 'mm',
                    'bleed' => 3,
                    'safe_area' => 3,
                    'margin' => 3,
                    'trim' => true,
                    'dpi' => 300,
                    'orientation' => 'landscape',
                    'print_area' => ['width' => 1063, 'height' => 591],
                    'guides' => ['showBleed' => true, 'showSafeZone' => true, 'showTrim' => true],
                ],
            ]
        );

        // TEMPLATE 2: Vivid Summer Festival Promotional Flyer (A5 Double-Sided)
        $frontFlyerJson = [
            'version' => '6.0.0',
            'background' => '#18181b',
            'objects' => [
                [
                    'type' => 'Image',
                    'src' => '/storage/products/GrDOgaqMkfvoaWBhsjKKV5I6sUiE6glie1XBCDki.jpg',
                    'left' => 0,
                    'top' => 0,
                    'width' => 1748,
                    'height' => 1200,
                    'scaleX' => 1.0,
                    'scaleY' => 1.0,
                ],
                [
                    'type' => 'Rect',
                    'left' => 0,
                    'top' => 1100,
                    'width' => 1748,
                    'height' => 1380,
                    'fill' => '#09090b',
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'SUMMER SOUNDWAVE 2026',
                    'fontSize' => 72,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#f59e0b',
                    'left' => 100,
                    'top' => 1180,
                ],
                [
                    'type' => 'Textbox',
                    'text' => '3 DAYS OF LIVE MUSIC, ARTS & FOOD TRUCKS',
                    'fontSize' => 28,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'fill' => '#38bdf8',
                    'left' => 100,
                    'top' => 1280,
                ],
                [
                    'type' => 'Textbox',
                    'text' => "DECEMBER 18-20  •  CENTENNIAL PARK SYDNEY\nTICKETS & LINEUP: WWW.SOUNDWAVEFEST.COM.AU",
                    'fontSize' => 24,
                    'fontFamily' => 'Inter',
                    'lineHeight' => 1.6,
                    'fill' => '#e4e4e7',
                    'left' => 100,
                    'top' => 1380,
                ],
            ],
        ];

        $backFlyerJson = [
            'version' => '6.0.0',
            'background' => '#09090b',
            'objects' => [
                [
                    'type' => 'Textbox',
                    'text' => 'FESTIVAL LINEUP & SCHEDULE',
                    'fontSize' => 54,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'fill' => '#ffffff',
                    'left' => 100,
                    'top' => 120,
                ],
                [
                    'type' => 'Image',
                    'src' => '/storage/products/8QivKeT2ZrL2YAQk0ESThOVYZrrc0TVuMXIA1ZGZ.png',
                    'left' => 100,
                    'top' => 260,
                    'width' => 800,
                    'height' => 500,
                    'scaleX' => 1.2,
                    'scaleY' => 1.2,
                ],
                [
                    'type' => 'Textbox',
                    'text' => "MAIN STAGE • ELECTRONIC TENT • ACOUSTIC GARDEN\nVIP LOUNGE & PASSES AVAILABLE ONLINE",
                    'fontSize' => 26,
                    'fontFamily' => 'Inter',
                    'fill' => '#a1a1aa',
                    'left' => 100,
                    'top' => 1100,
                ],
            ],
        ];

        DesignTemplate::updateOrCreate(
            ['name' => 'Summer Soundwave Festival Flyer'],
            [
                'product_id' => $prodFlyers->id,
                'category' => 'Events',
                'is_active' => true,
                'thumbnail_url' => '/storage/products/GrDOgaqMkfvoaWBhsjKKV5I6sUiE6glie1XBCDki.jpg',
                'print_sides' => 'both',
                'width_mm' => 148.00,
                'height_mm' => 210.00,
                'margin_mm' => 4.00,
                'bleed_mm' => 3.00,
                'safe_area_mm' => 4.00,
                'canvas_json' => $frontFlyerJson,
                'back_canvas_json' => $backFlyerJson,
                'artwork_config' => [
                    'width' => 148,
                    'height' => 210,
                    'unit' => 'mm',
                    'bleed' => 3,
                    'safe_area' => 4,
                    'margin' => 4,
                    'trim' => true,
                    'dpi' => 300,
                    'orientation' => 'portrait',
                    'print_area' => ['width' => 1748, 'height' => 2480],
                    'guides' => ['showBleed' => true, 'showSafeZone' => true, 'showTrim' => true],
                ],
            ]
        );

        // TEMPLATE 3: Artisan Roast Coffee Label Sticker (Single-Sided)
        $frontStickerJson = [
            'version' => '6.0.0',
            'background' => '#292524',
            'objects' => [
                [
                    'type' => 'Circle',
                    'left' => 50,
                    'top' => 50,
                    'radius' => 540,
                    'fill' => '#1c1917',
                    'stroke' => '#d97706',
                    'strokeWidth' => 12,
                ],
                [
                    'type' => 'Image',
                    'src' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                    'left' => 380,
                    'top' => 200,
                    'width' => 400,
                    'height' => 400,
                    'scaleX' => 1.0,
                    'scaleY' => 1.0,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'ARTISAN ROAST',
                    'fontSize' => 64,
                    'fontFamily' => 'Inter',
                    'fontWeight' => 'bold',
                    'textAlign' => 'center',
                    'fill' => '#fef3c7',
                    'left' => 320,
                    'top' => 660,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'SINGLE ORIGIN • ETHIOPIA YIRGACHEFFE',
                    'fontSize' => 24,
                    'fontFamily' => 'Inter',
                    'fontWeight' => '600',
                    'charSpacing' => 150,
                    'textAlign' => 'center',
                    'fill' => '#d97706',
                    'left' => 240,
                    'top' => 760,
                ],
                [
                    'type' => 'Textbox',
                    'text' => 'ROASTED IN BONDI BEACH • 250G NETT',
                    'fontSize' => 18,
                    'fontFamily' => 'Inter',
                    'charSpacing' => 100,
                    'textAlign' => 'center',
                    'fill' => '#a8a29e',
                    'left' => 330,
                    'top' => 840,
                ],
            ],
        ];

        DesignTemplate::updateOrCreate(
            ['name' => 'Artisan Roast Craft Coffee Sticker'],
            [
                'product_id' => $prodStickers->id,
                'category' => 'Food & Drink',
                'is_active' => true,
                'thumbnail_url' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                'print_sides' => 'front',
                'width_mm' => 100.00,
                'height_mm' => 100.00,
                'margin_mm' => 3.00,
                'bleed_mm' => 2.00,
                'safe_area_mm' => 3.00,
                'canvas_json' => $frontStickerJson,
                'artwork_config' => [
                    'width' => 100,
                    'height' => 100,
                    'unit' => 'mm',
                    'bleed' => 2,
                    'safe_area' => 3,
                    'margin' => 3,
                    'trim' => true,
                    'dpi' => 300,
                    'orientation' => 'square',
                    'print_area' => ['width' => 1181, 'height' => 1181],
                    'guides' => ['showBleed' => true, 'showSafeZone' => true, 'showTrim' => true],
                ],
            ]
        );

        // =========================================================================
        // 5. DESIGNER ASSETS ACROSS ALL TYPES (FRAMES, SVG, PNG, TIF, PHOTOS, BACKGROUNDS)
        // =========================================================================

        // Categories
        $catFrame = DesignAssetCategory::updateOrCreate(
            ['slug' => 'designer-frames'],
            [
                'name' => 'Designer Photo Frames',
                'asset_type' => 'frame',
                'description' => 'Polaroid, minimal, border, and decorative frames',
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        $catSvg = DesignAssetCategory::updateOrCreate(
            ['slug' => 'vector-icons-badges'],
            [
                'name' => 'Vector Badges & Icons (SVG)',
                'asset_type' => 'element',
                'description' => 'Crisp scalable vector graphics, ribbons, badges and icons',
                'is_active' => true,
                'sort_order' => 2,
            ]
        );

        $catPng = DesignAssetCategory::updateOrCreate(
            ['slug' => 'png-cutouts-badges'],
            [
                'name' => 'Transparent PNG Graphics',
                'asset_type' => 'element',
                'description' => 'High-resolution transparent logos, stamps, and graphics',
                'is_active' => true,
                'sort_order' => 3,
            ]
        );

        $catTif = DesignAssetCategory::updateOrCreate(
            ['slug' => 'high-res-print-masters-tiff'],
            [
                'name' => 'High-Res Print Masters (TIFF)',
                'asset_type' => 'element',
                'description' => 'CMYK ultra high-definition TIFF graphic assets for offset printing',
                'is_active' => true,
                'sort_order' => 4,
            ]
        );

        $catPhoto = DesignAssetCategory::updateOrCreate(
            ['slug' => 'stock-photography'],
            [
                'name' => 'Commercial Stock Photography',
                'asset_type' => 'photo',
                'description' => 'Architecture, lifestyle, corporate, and culinary stock photos',
                'is_active' => true,
                'sort_order' => 5,
            ]
        );

        $catBg = DesignAssetCategory::updateOrCreate(
            ['slug' => 'designer-backgrounds'],
            [
                'name' => 'Designer Backgrounds & Textures',
                'asset_type' => 'background',
                'description' => 'High-impact print wallpapers and surface textures',
                'is_active' => true,
                'sort_order' => 6,
            ]
        );

        // Assets: 1. FRAMES
        $frames = [
            [
                'name' => 'Classic Polaroid Photo Frame',
                'slug' => 'classic-polaroid-photo-frame',
                'path' => 'designer/frames/0b7ea904-334f-4a20-a55f-f05da1a95ab6.png',
                'thumb' => '/storage/designer/frames/0b7ea904-334f-4a20-a55f-f05da1a95ab6.png',
            ],
            [
                'name' => 'Minimalist White Photo Border',
                'slug' => 'minimalist-white-photo-border',
                'path' => 'designer/frames/69d15a6c-14bf-4816-bc9d-da3ec420e8e9.png',
                'thumb' => '/storage/designer/frames/69d15a6c-14bf-4816-bc9d-da3ec420e8e9.png',
            ],
            [
                'name' => 'Vintage Matte Gold Frame',
                'slug' => 'vintage-matte-gold-frame',
                'path' => 'designer/frames/710ee587-b1c2-4693-a081-317c30ca230f.png',
                'thumb' => '/storage/designer/frames/710ee587-b1c2-4693-a081-317c30ca230f.png',
            ],
            [
                'name' => 'Luxury Geometric Card Frame',
                'slug' => 'luxury-geometric-card-frame',
                'path' => 'designer/frames/cde538d2-1049-48de-a895-168f9ed06dcd.png',
                'thumb' => '/storage/designer/frames/cde538d2-1049-48de-a895-168f9ed06dcd.png',
            ],
        ];

        foreach ($frames as $f) {
            DesignAsset::updateOrCreate(
                ['slug' => $f['slug']],
                [
                    'category_id' => $catFrame->id,
                    'name' => $f['name'],
                    'asset_type' => 'frame',
                    'file_path' => $f['path'],
                    'file_url' => '/storage/' . $f['path'],
                    'thumbnail_url' => $f['thumb'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 1,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => '/storage/' . $f['path'],
                    ],
                ]
            );
        }

        // Assets: 2. SVG VECTORS
        $svgs = [
            [
                'name' => 'Golden Star Emblem (SVG)',
                'slug' => 'golden-star-emblem-svg',
                'path' => 'designer/elements/40adea36-e9b3-4609-bc3b-51c0c75b52ab.svg',
            ],
            [
                'name' => 'Crown Vector Graphic (SVG)',
                'slug' => 'crown-vector-graphic-svg',
                'path' => 'designer/elements/86e4225c-13f9-48b5-b34a-db5ef616e3f3.svg',
            ],
            [
                'name' => 'Quality Ribbon Banner (SVG)',
                'slug' => 'quality-ribbon-banner-svg',
                'path' => 'designer/elements/8cfd7d4c-1f6e-40bb-b35b-1cc3ea73f338.svg',
            ],
            [
                'name' => 'Dynamic Modern Wave (SVG)',
                'slug' => 'dynamic-modern-wave-svg',
                'path' => 'designer/elements/b216b6bd-1328-4c21-ad33-353ac4405b25.svg',
            ],
        ];

        foreach ($svgs as $s) {
            DesignAsset::updateOrCreate(
                ['slug' => $s['slug']],
                [
                    'category_id' => $catSvg->id,
                    'name' => $s['name'],
                    'asset_type' => 'element',
                    'file_path' => $s['path'],
                    'file_url' => '/storage/' . $s['path'],
                    'thumbnail_url' => '/storage/' . $s['path'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 1,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => '/storage/' . $s['path'],
                    ],
                ]
            );
        }

        // Assets: 3. PNG GRAPHICS & SEALS
        $pngs = [
            [
                'name' => 'Official Seal of Authenticity (PNG)',
                'slug' => 'official-seal-authenticity-png',
                'path' => 'designer/elements/5e67fff6-3efb-4ed0-a425-7e5c64f62395.png',
            ],
            [
                'name' => 'Eco-Certified Green Stamp (PNG)',
                'slug' => 'eco-certified-green-stamp-png',
                'path' => 'designer/elements/7f02f46b-340e-4ae2-b577-4f886a7a524c.png',
            ],
            [
                'name' => '100% Satisfaction Guarantee (PNG)',
                'slug' => 'satisfaction-guarantee-badge-png',
                'path' => 'designer/elements/f5be9354-96c2-4d94-adec-42199692cf55.png',
            ],
            [
                'name' => 'Vibrant Watercolor Splash (PNG)',
                'slug' => 'vibrant-watercolor-splash-png',
                'path' => 'designer/photos/193ae509-5459-410d-9886-cf776a896f99.png',
            ],
        ];

        foreach ($pngs as $p) {
            DesignAsset::updateOrCreate(
                ['slug' => $p['slug']],
                [
                    'category_id' => $catPng->id,
                    'name' => $p['name'],
                    'asset_type' => 'element',
                    'file_path' => $p['path'],
                    'file_url' => '/storage/' . $p['path'],
                    'thumbnail_url' => '/storage/' . $p['path'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 2,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => '/storage/' . $p['path'],
                    ],
                ]
            );
        }

        // Assets: 4. TIFF HIGH-RES GRAPHICS
        $tiffs = [
            [
                'name' => 'CMYK Packaging Master Texture (TIF)',
                'slug' => 'cmyk-packaging-master-texture-tif',
                'path' => 'designer/elements/2260da6f-7d43-494f-bce9-2aa639387e38.tif',
                'thumb' => '/storage/designer/thumbnails/5098fde3-5925-4044-bf47-16133f6f05f8.png',
            ],
            [
                'name' => 'Ultra-HD Prepress Specimen (TIFF)',
                'slug' => 'ultra-hd-prepress-specimen-tiff',
                'path' => 'designer/elements/aa0c460a-a3fe-43f6-83fb-1aa0c8e3827b.tiff',
                'thumb' => '/storage/designer/thumbnails/df9fe3cd-b11f-46b2-82f4-1407a9101ddd.png',
            ],
            [
                'name' => 'Fine Art Exhibition Proof (TIF)',
                'slug' => 'fine-art-exhibition-proof-tif',
                'path' => 'designer/photos/159548f2-b277-4768-862c-5b86fbef8172.tif',
                'thumb' => '/storage/designer/thumbnails/57d79cf2-3e4c-4544-9c65-2fa7534bd0cb.png',
            ],
        ];

        foreach ($tiffs as $t) {
            DesignAsset::updateOrCreate(
                ['slug' => $t['slug']],
                [
                    'category_id' => $catTif->id,
                    'name' => $t['name'],
                    'asset_type' => 'element',
                    'file_path' => $t['path'],
                    'file_url' => '/storage/' . $t['path'],
                    'thumbnail_url' => $t['thumb'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 3,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => $t['thumb'], // Fabric uses browser-renderable thumbnail
                    ],
                ]
            );
        }

        // Assets: 5. PHOTOS
        $photos = [
            [
                'name' => 'Modern Architecture & Tower',
                'slug' => 'modern-architecture-tower-photo',
                'path' => 'designer/photos/219b4393-63f2-4b51-ba4a-c897dbb7e0e1.jpg',
            ],
            [
                'name' => 'Creative Agency Co-Working Office',
                'slug' => 'creative-agency-coworking-office',
                'path' => 'designer/photos/3c2024c5-84a7-4548-97c1-5746c0199295.jpg',
            ],
            [
                'name' => 'Artisan Coffee Roasting Still',
                'slug' => 'artisan-coffee-roasting-still',
                'path' => 'designer/photos/8e7b4f5b-bcae-4c73-a66a-dc3094e2972f.jpg',
            ],
            [
                'name' => 'Business Team Executive Meeting',
                'slug' => 'business-team-executive-meeting',
                'path' => 'designer/photos/365afc2d-874c-42bb-9a5b-c926b92d5076.jpeg',
            ],
        ];

        foreach ($photos as $ph) {
            DesignAsset::updateOrCreate(
                ['slug' => $ph['slug']],
                [
                    'category_id' => $catPhoto->id,
                    'name' => $ph['name'],
                    'asset_type' => 'photo',
                    'file_path' => $ph['path'],
                    'file_url' => '/storage/' . $ph['path'],
                    'thumbnail_url' => '/storage/' . $ph['path'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 4,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => '/storage/' . $ph['path'],
                    ],
                ]
            );
        }

        // Assets: 6. BACKGROUNDS
        $bgs = [
            [
                'name' => 'Dark Slate Minimalist Wallpaper',
                'slug' => 'dark-slate-minimalist-wallpaper',
                'path' => 'designer/frames/1212ac6a-5e1b-4ad3-9330-b9a7d2e8bec6.jpg',
            ],
            [
                'name' => 'Abstract Texture Wallpaper',
                'slug' => 'abstract-texture-wallpaper',
                'path' => 'designer/frames/37afc7c8-ae17-4029-bcd8-e97555d9d715.jpg',
            ],
        ];

        foreach ($bgs as $bg) {
            DesignAsset::updateOrCreate(
                ['slug' => $bg['slug']],
                [
                    'category_id' => $catBg->id,
                    'name' => $bg['name'],
                    'asset_type' => 'background',
                    'file_path' => $bg['path'],
                    'file_url' => '/storage/' . $bg['path'],
                    'thumbnail_url' => '/storage/' . $bg['path'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => 5,
                    'fabric_json' => [
                        'type' => 'Image',
                        'src' => '/storage/' . $bg['path'],
                    ],
                ]
            );
        }
    }
}
