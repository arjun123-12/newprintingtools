<?php

namespace Database\Seeders;

use App\Models\DesignAsset;
use App\Models\DesignAssetCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class SvgShapesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $shapesDir = storage_path('app/public/designer/shapes');
        if (!File::exists($shapesDir)) {
            File::makeDirectory($shapesDir, 0755, true);
        }

        // 1. Define standard core SVG shapes to ensure comprehensive designer library
        $coreShapes = [
            // Category: Basic Geometric
            [
                'category' => 'basic-shapes',
                'name' => 'Circle',
                'filename' => 'shape-circle.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Square',
                'filename' => 'shape-square.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect x="15" y="15" width="370" height="370" rx="4" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Rounded Rectangle',
                'filename' => 'shape-rounded-rectangle.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 350"><rect x="15" y="15" width="470" height="320" rx="48" ry="48" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Triangle',
                'filename' => 'shape-triangle.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 350"><polygon points="200,20 380,330 20,330" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Right Triangle',
                'filename' => 'shape-right-triangle.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="20,20 380,380 20,380" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Diamond Rhombus',
                'filename' => 'shape-diamond.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="200,15 385,200 200,385 15,200" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Ellipse Oval',
                'filename' => 'shape-oval.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320"><ellipse cx="250" cy="160" rx="235" ry="145" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Semi-Circle',
                'filename' => 'shape-semi-circle.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><path d="M 15 205 A 185 185 0 0 1 385 205 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Parallelogram',
                'filename' => 'shape-parallelogram.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300"><polygon points="100,20 435,20 350,280 15,280" fill="#111111"/></svg>',
            ],
            [
                'category' => 'basic-shapes',
                'name' => 'Trapezoid',
                'filename' => 'shape-trapezoid.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300"><polygon points="110,25 340,25 435,275 15,275" fill="#111111"/></svg>',
            ],

            // Category: Stars & Polygons
            [
                'category' => 'stars-and-polygons',
                'name' => 'Hexagon',
                'filename' => 'shape-hexagon.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="200,15 370,105 370,295 200,385 30,295 30,105" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => 'Octagon',
                'filename' => 'shape-octagon.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="120,15 280,15 385,120 385,280 280,385 120,385 15,280 15,120" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => 'Pentagon',
                'filename' => 'shape-pentagon.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="200,18 385,152 314,370 86,370 15,152" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => '5-Point Star',
                'filename' => 'shape-star-5.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="200,15 258,135 390,154 295,246 317,378 200,316 83,378 105,246 10,154 142,135" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => '4-Point Star',
                'filename' => 'shape-star-4.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M 200 15 Q 200 200 15 200 Q 200 200 200 385 Q 200 200 385 200 Q 200 200 200 15 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => '8-Point Star',
                'filename' => 'shape-star-8.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="200,15 238,125 330,70 275,162 385,200 275,238 330,330 238,275 200,385 162,275 70,330 125,238 15,200 125,162 70,70 162,125" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => '12-Point Starburst',
                'filename' => 'shape-starburst-12.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M200,15 L220,110 L292,38 L270,135 L362,108 L308,188 L385,200 L308,212 L362,292 L270,265 L292,362 L220,290 L200,385 L180,290 L108,362 L130,265 L38,292 L92,212 L15,200 L92,188 L38,108 L130,135 L108,38 L180,110 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'stars-and-polygons',
                'name' => 'Badge Rosette',
                'filename' => 'shape-badge-seal.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M200,15 C215,35 235,35 250,20 C265,35 285,35 300,20 C315,35 335,40 345,60 C355,80 375,85 380,105 C385,125 395,145 390,165 C385,185 395,205 385,225 C375,245 380,265 365,280 C350,295 350,315 330,325 C310,335 305,355 285,360 C265,365 250,380 230,380 C210,380 190,380 170,380 C150,380 135,365 115,360 C95,355 90,335 70,325 C50,315 50,295 35,280 C20,265 25,245 15,225 C5,205 15,185 10,165 C5,145 15,125 20,105 C25,85 45,80 55,60 C65,40 85,35 100,20 C115,35 135,35 150,20 C165,35 185,35 200,15 Z" fill="#111111"/></svg>',
            ],

            // Category: Symbols & Badges
            [
                'category' => 'symbols-and-badges',
                'name' => 'Heart',
                'filename' => 'shape-heart.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370"><path d="M200,350 C200,350 25,230 25,120 C25,50 80,15 145,15 C175,15 200,45 200,45 C200,45 225,15 255,15 C320,15 375,50 375,120 C375,230 200,350 200,350 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'symbols-and-badges',
                'name' => 'Shield Crest',
                'filename' => 'shape-shield.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 450"><path d="M200,15 L375,55 C375,220 310,380 200,435 C90,380 25,220 25,55 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'symbols-and-badges',
                'name' => 'Speech Bubble',
                'filename' => 'shape-speech-bubble.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 380"><path d="M40,170 C40,80 120,20 225,20 C330,20 410,80 410,170 C410,260 330,320 225,320 C180,320 145,310 115,295 L40,360 L55,275 C45,245 40,210 40,170 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'symbols-and-badges',
                'name' => 'Cloud',
                'filename' => 'shape-cloud.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300"><path d="M120,260 L350,260 C395,260 430,225 430,180 C430,140 400,105 360,102 C350,55 310,20 260,20 C220,20 185,45 170,80 C155,70 135,65 115,65 C70,65 30,100 25,145 C10,165 5,185 10,210 C15,240 45,260 80,260 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'symbols-and-badges',
                'name' => 'Plus Cross',
                'filename' => 'shape-cross.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><polygon points="145,20 255,20 255,145 380,145 380,255 255,255 255,380 145,380 145,255 20,255 20,145 145,145" fill="#111111"/></svg>',
            ],
            [
                'category' => 'symbols-and-badges',
                'name' => 'Crescent Moon',
                'filename' => 'shape-moon.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M340,30 C190,45 100,165 100,270 C100,320 120,360 145,385 C70,345 25,265 25,175 C25,85 85,20 170,15 C210,12 280,20 340,30 Z" fill="#111111"/></svg>',
            ],

            // Category: Arrows & Directions
            [
                'category' => 'arrows-and-directions',
                'name' => 'Arrow Right',
                'filename' => 'shape-arrow-right.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300"><polygon points="20,105 250,105 250,30 430,150 250,270 250,195 20,195" fill="#111111"/></svg>',
            ],
            [
                'category' => 'arrows-and-directions',
                'name' => 'Arrow Left',
                'filename' => 'shape-arrow-left.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300"><polygon points="430,105 200,105 200,30 20,150 200,270 200,195 430,195" fill="#111111"/></svg>',
            ],
            [
                'category' => 'arrows-and-directions',
                'name' => 'Chevron Right',
                'filename' => 'shape-chevron-right.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 400"><polygon points="30,30 240,200 30,370 120,370 330,200 120,30" fill="#111111"/></svg>',
            ],
            [
                'category' => 'arrows-and-directions',
                'name' => 'Double Arrow',
                'filename' => 'shape-double-arrow.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 260"><polygon points="120,20 20,130 120,240 120,175 380,175 380,240 480,130 380,20 380,85 120,85" fill="#111111"/></svg>',
            ],

            // Category: Banners & Frames
            [
                'category' => 'banners-and-frames',
                'name' => 'Ribbon Banner',
                'filename' => 'shape-ribbon-banner.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200"><polygon points="60,20 440,20 400,100 440,180 60,180 100,100" fill="#111111"/></svg>',
            ],
            [
                'category' => 'banners-and-frames',
                'name' => 'Pill Capsule',
                'filename' => 'shape-pill.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 240"><rect x="15" y="15" width="470" height="210" rx="105" ry="105" fill="#111111"/></svg>',
            ],
            [
                'category' => 'banners-and-frames',
                'name' => 'Ticket Badge',
                'filename' => 'shape-ticket.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><path d="M 20 20 L 460 20 L 460 110 A 40 40 0 0 0 460 190 L 460 280 L 20 280 L 20 190 A 40 40 0 0 0 20 110 Z" fill="#111111"/></svg>',
            ],

            // Category: Decorative & Organic
            [
                'category' => 'decorative-and-organic',
                'name' => 'Organic Blob 1',
                'filename' => 'shape-blob-1.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M340,150 C380,220 340,310 270,350 C200,390 120,380 70,320 C20,260 0,160 50,100 C100,40 200,-10 280,30 C330,60 320,110 340,150 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'decorative-and-organic',
                'name' => 'Organic Blob 2',
                'filename' => 'shape-blob-2.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M310,90 C370,160 360,260 300,320 C240,380 140,380 80,330 C20,280 10,180 50,110 C90,40 180,10 250,30 C280,40 290,70 310,90 Z" fill="#111111"/></svg>',
            ],
            [
                'category' => 'decorative-and-organic',
                'name' => 'Liquid Wave',
                'filename' => 'shape-liquid-wave.svg',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 350"><path d="M 20 120 C 120 40 200 200 300 120 C 400 40 460 140 480 200 L 480 320 L 20 320 Z" fill="#111111"/></svg>',
            ],
        ];

        // 2. Categories definition
        $categoriesData = [
            'basic-shapes' => [
                'name' => 'Basic Geometric',
                'description' => 'Fundamental geometric shapes: squares, circles, triangles, polygons',
                'sort_order' => 1,
            ],
            'stars-and-polygons' => [
                'name' => 'Stars & Polygons',
                'description' => 'Stars, rosettes, bursts, hexagons and multi-sided polygons',
                'sort_order' => 2,
            ],
            'symbols-and-badges' => [
                'name' => 'Symbols & Badges',
                'description' => 'Hearts, shields, speech bubbles, clouds and insignia',
                'sort_order' => 3,
            ],
            'arrows-and-directions' => [
                'name' => 'Arrows & Pointers',
                'description' => 'Directional pointers, chevrons and callout arrows',
                'sort_order' => 4,
            ],
            'banners-and-frames' => [
                'name' => 'Banners & Frames',
                'description' => 'Ribbons, capsules, badges and framed outlines',
                'sort_order' => 5,
            ],
            'decorative-and-organic' => [
                'name' => 'Decorative & Organic',
                'description' => 'Organic blobs, fluid curves, liquid waves and modern design elements',
                'sort_order' => 6,
            ],
        ];

        $categoryMap = [];
        foreach ($categoriesData as $slug => $c) {
            $cat = DesignAssetCategory::updateOrCreate(
                ['slug' => $slug, 'asset_type' => 'shape'],
                [
                    'name' => $c['name'],
                    'description' => $c['description'],
                    'is_active' => true,
                    'sort_order' => $c['sort_order'],
                ]
            );
            $categoryMap[$slug] = $cat;
        }

        // 3. Write core shape files and seed them into database
        $sortIndex = 1;
        foreach ($coreShapes as $item) {
            $filePath = $shapesDir . '/' . $item['filename'];
            File::put($filePath, $item['svg']);

            $slug = 'shape-' . Str::slug($item['name']);
            $category = $categoryMap[$item['category']] ?? reset($categoryMap);

            DesignAsset::updateOrCreate(
                ['slug' => $slug],
                [
                    'category_id' => $category->id,
                    'name' => $item['name'],
                    'asset_type' => 'shape',
                    'file_path' => 'designer/shapes/' . $item['filename'],
                    'file_url' => '/storage/designer/shapes/' . $item['filename'],
                    'thumbnail_path' => 'designer/shapes/' . $item['filename'],
                    'thumbnail_url' => '/storage/designer/shapes/' . $item['filename'],
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => $sortIndex++,
                    'metadata' => [
                        'shape' => [
                            'fill' => '#111111',
                            'recolourable' => true,
                            'allowPhotoDrop' => true,
                        ],
                        'is_vector' => true,
                        'width' => 400,
                        'height' => 400,
                    ],
                ]
            );
        }

        // 4. Also register any existing uploaded SVGs in designer/shapes
        $existingFiles = File::files($shapesDir);
        $coreFilenames = collect($coreShapes)->pluck('filename')->flip()->all();

        $categoryKeys = array_keys($categoryMap);
        $catCount = count($categoryKeys);
        $catIdx = 0;

        foreach ($existingFiles as $file) {
            $filename = $file->getFilename();
            if (!str_ends_with(strtolower($filename), '.svg') || isset($coreFilenames[$filename])) {
                continue;
            }

            // Generate clean human title from filename
            $rawName = pathinfo($filename, PATHINFO_FILENAME);
            $name = 'Custom Shape ' . strtoupper(substr($rawName, 0, 6));
            $slug = 'custom-shape-' . strtolower(substr($rawName, 0, 12));

            // Distribute across categories
            $assignedCategoryKey = $categoryKeys[$catIdx % $catCount];
            $catIdx++;
            $category = $categoryMap[$assignedCategoryKey];

            DesignAsset::updateOrCreate(
                ['slug' => $slug],
                [
                    'category_id' => $category->id,
                    'name' => $name,
                    'asset_type' => 'shape',
                    'file_path' => 'designer/shapes/' . $filename,
                    'file_url' => '/storage/designer/shapes/' . $filename,
                    'thumbnail_path' => 'designer/shapes/' . $filename,
                    'thumbnail_url' => '/storage/designer/shapes/' . $filename,
                    'provider' => 'admin',
                    'is_active' => true,
                    'sort_order' => $sortIndex++,
                    'metadata' => [
                        'shape' => [
                            'fill' => '#111111',
                            'recolourable' => true,
                            'allowPhotoDrop' => true,
                        ],
                        'is_vector' => true,
                        'width' => 400,
                        'height' => 400,
                    ],
                ]
            );
        }

        // 5. Also seed Text presets if not seeded
        $this->call(DesignAssetSeeder::class);
    }
}
