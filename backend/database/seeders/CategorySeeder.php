<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Business Cards',
                'slug' => 'business-cards',
                'description' => 'Premium, luxury, and eco-friendly business cards crafted on heavy stocks.',
                'image_url' => 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                'sort_order' => 1,
            ],
            [
                'name' => 'Flyers & Marketing',
                'slug' => 'flyers-marketing',
                'description' => 'High-impact promotional flyers, brochures, folded menus, and postcards.',
                'image_url' => 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=800&q=80',
                'sort_order' => 2,
            ],
            [
                'name' => 'Signage & Banners',
                'slug' => 'signage-banners',
                'description' => 'Large format weather-resistant corflute signs, pull-up banners, and vinyl banners.',
                'image_url' => 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
                'sort_order' => 3,
            ],
            [
                'name' => 'Stickers & Labels',
                'slug' => 'stickers-labels',
                'description' => 'Custom die-cut vinyl stickers, sheet labels, and product packaging seals.',
                'image_url' => 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?auto=format&fit=crop&w=800&q=80',
                'sort_order' => 4,
            ],
            [
                'name' => 'Stationery & Booklets',
                'slug' => 'stationery-booklets',
                'description' => 'Custom letterheads, with-comps slips, presentation folders, and saddle-stitched booklets.',
                'image_url' => 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80',
                'sort_order' => 5,
            ],
        ];

        foreach ($categories as $cat) {
            Category::firstOrCreate(
                ['slug' => $cat['slug']],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'image_url' => $cat['image_url'],
                    'sort_order' => $cat['sort_order'],
                    'is_active' => true,
                ]
            );
        }
    }
}
