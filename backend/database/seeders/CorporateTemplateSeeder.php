<?php

namespace Database\Seeders;

use App\Models\DesignTemplate;
use App\Models\Product;
use Illuminate\Database\Seeder;

class CorporateTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $product = Product::query()->first();
        if (!$product) return;

        DesignTemplate::updateOrCreate(
            ['name' => 'Corporate Business Card with Local Photo'],
            [
                'product_id' => $product->id,
                'category' => 'Corporate',
                'is_active' => true,
                'thumbnail_url' => 'http://127.0.0.1:8000/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                'canvas_json' => [
                    'version' => '6.0.0',
                    'objects' => [
                        [
                            'type' => 'Rect',
                            'left' => 50,
                            'top' => 50,
                            'width' => 963,
                            'height' => 491,
                            'fill' => '#1e293b',
                        ],
                        [
                            'type' => 'Image',
                            'src' => 'http://127.0.0.1:8000/storage/products/0ebInHuOxeVMdhPWgk8RjbKm7UZI5DH7Wkw05Ttu.png',
                            'left' => 100,
                            'top' => 100,
                            'width' => 300,
                            'height' => 300,
                            'scaleX' => 0.6,
                            'scaleY' => 0.6,
                        ],
                        [
                            'type' => 'Textbox',
                            'text' => 'Alexander Smith',
                            'fontSize' => 32,
                            'fill' => '#ffffff',
                            'left' => 320,
                            'top' => 120,
                        ],
                        [
                            'type' => 'Group',
                            'left' => 320,
                            'top' => 200,
                            'objects' => [
                                [
                                    'type' => 'FabricImage',
                                    'src' => '/storage/products/C7CddGg63XRCdEtzGJ3f9V6jca7geoTsYIfcxONf.jpg',
                                    'left' => 0,
                                    'top' => 0,
                                    'width' => 100,
                                    'height' => 100,
                                    'scaleX' => 0.5,
                                    'scaleY' => 0.5,
                                ],
                                [
                                    'type' => 'Textbox',
                                    'text' => 'Senior Vice President',
                                    'fontSize' => 20,
                                    'fill' => '#38bdf8',
                                    'left' => 70,
                                    'top' => 10,
                                ],
                            ],
                        ],
                    ],
                    'background' => '#0f172a',
                ],
            ]
        );
    }
}
