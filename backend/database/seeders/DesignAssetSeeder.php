<?php

namespace Database\Seeders;

use App\Models\DesignAsset;
use App\Models\DesignAssetCategory;
use Illuminate\Database\Seeder;

class DesignAssetSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create or get Default Text Category
        $textCategory = DesignAssetCategory::updateOrCreate(
            ['slug' => 'standard-text-presets'],
            [
                'name' => 'Standard Text Presets',
                'asset_type' => 'text',
                'description' => 'Default typography presets for heading, subheading, and body text',
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        // 2. Seed 'Add a heading'
        DesignAsset::updateOrCreate(
            ['slug' => 'add-a-heading'],
            [
                'category_id' => $textCategory->id,
                'name' => 'Add a heading',
                'asset_type' => 'text',
                'provider' => 'admin',
                'is_active' => true,
                'sort_order' => 1,
                'fabric_json' => [
                    'type' => 'Textbox',
                    'text' => 'Add a heading',
                    'fontFamily' => 'Inter',
                    'fontSize' => 48,
                    'fontWeight' => 'bold',
                    'fontStyle' => 'normal',
                    'fill' => '#111111',
                    'textAlign' => 'center',
                    'editable' => true,
                    'selectable' => true,
                ],
                'metadata' => [
                    'preset_type' => 'heading',
                ],
            ]
        );

        // 3. Seed 'Add a subheading'
        DesignAsset::updateOrCreate(
            ['slug' => 'add-a-subheading'],
            [
                'category_id' => $textCategory->id,
                'name' => 'Add a subheading',
                'asset_type' => 'text',
                'provider' => 'admin',
                'is_active' => true,
                'sort_order' => 2,
                'fabric_json' => [
                    'type' => 'Textbox',
                    'text' => 'Add a subheading',
                    'fontFamily' => 'Inter',
                    'fontSize' => 28,
                    'fontWeight' => '600',
                    'fontStyle' => 'normal',
                    'fill' => '#334155',
                    'textAlign' => 'center',
                    'editable' => true,
                    'selectable' => true,
                ],
                'metadata' => [
                    'preset_type' => 'subheading',
                ],
            ]
        );

        // 4. Seed 'Add body text'
        DesignAsset::updateOrCreate(
            ['slug' => 'add-body-text'],
            [
                'category_id' => $textCategory->id,
                'name' => 'Add body text',
                'asset_type' => 'text',
                'provider' => 'admin',
                'is_active' => true,
                'sort_order' => 3,
                'fabric_json' => [
                    'type' => 'Textbox',
                    'text' => 'Add body text. Double-click to edit content directly on canvas.',
                    'fontFamily' => 'Inter',
                    'fontSize' => 16,
                    'fontWeight' => 'normal',
                    'fontStyle' => 'normal',
                    'fill' => '#475569',
                    'textAlign' => 'left',
                    'editable' => true,
                    'selectable' => true,
                ],
                'metadata' => [
                    'preset_type' => 'body',
                ],
            ]
        );
    }
}
