<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Port data to the new tables
        $products = DB::table('products')->get();

        foreach ($products as $product) {
            $side1Id = Str::uuid()->toString();
            
            DB::table('product_sides')->insert([
                'id' => $side1Id,
                'product_id' => $product->id,
                'side_number' => 1,
                'name' => 'Front',
                'type' => 'front',
                'sort_order' => 1,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Assign print areas
            DB::table('product_print_areas')
                ->where('product_id', $product->id)
                ->where('name', 'Front Side')
                ->update(['product_side_id' => $side1Id]);

            $side2Id = null;
            if ($product->print_sides === 'both') {
                $side2Id = Str::uuid()->toString();
                DB::table('product_sides')->insert([
                    'id' => $side2Id,
                    'product_id' => $product->id,
                    'side_number' => 2,
                    'name' => 'Back',
                    'type' => 'back',
                    'sort_order' => 2,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('product_print_areas')
                    ->where('product_id', $product->id)
                    ->where('name', 'Back Side')
                    ->update(['product_side_id' => $side2Id]);
            }

            // Port design templates
            $templates = DB::table('design_templates')->where('product_id', $product->id)->get();
            foreach ($templates as $template) {
                if ($template->canvas_json) {
                    DB::table('design_template_pages')->insert([
                        'id' => Str::uuid()->toString(),
                        'design_template_id' => $template->id,
                        'product_side_id' => $side1Id,
                        'canvas_json' => $template->canvas_json,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                if ($side2Id && $template->back_canvas_json) {
                    DB::table('design_template_pages')->insert([
                        'id' => Str::uuid()->toString(),
                        'design_template_id' => $template->id,
                        'product_side_id' => $side2Id,
                        'canvas_json' => $template->back_canvas_json,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        // Port Artworks
        $artworks = DB::table('artworks')->get();
        foreach ($artworks as $artwork) {
            if ($artwork->canvas_json) {
                $side = DB::table('product_sides')
                    ->where('product_id', $artwork->product_id)
                    ->where('side_number', 1)
                    ->first();

                if ($side) {
                    DB::table('artwork_pages')->insert([
                        'id' => Str::uuid()->toString(),
                        'artwork_id' => $artwork->id,
                        'product_side_id' => $side->id,
                        'canvas_json' => $artwork->canvas_json,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('product_sides')->truncate();
        DB::table('design_template_pages')->truncate();
        DB::table('artwork_pages')->truncate();
        
        DB::table('product_print_areas')->update(['product_side_id' => null]);
    }
};
