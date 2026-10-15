<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Pivot table for product <-> category multi-assignment
        if (!Schema::hasTable('category_product')) {
            Schema::create('category_product', function (Blueprint $table) {
                $table->uuid('category_id');
                $table->uuid('product_id');
                $table->timestamps();

                $table->primary(['category_id', 'product_id']);
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
                $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
                $table->index('product_id');
            });
        }

        // Backfill existing product category assignments
        $products = DB::table('products')->whereNotNull('category_id')->select('id', 'category_id')->get();
        foreach ($products as $product) {
            $categoryExists = DB::table('categories')->where('id', $product->category_id)->exists();
            if ($categoryExists) {
                DB::table('category_product')->insertOrIgnore([
                    'category_id' => $product->category_id,
                    'product_id' => $product->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 2. Pivot table for design_template <-> category multi-assignment
        if (!Schema::hasTable('category_design_template')) {
            Schema::create('category_design_template', function (Blueprint $table) {
                $table->uuid('category_id');
                $table->uuid('design_template_id');
                $table->timestamps();

                $table->primary(['category_id', 'design_template_id']);
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
                $table->foreign('design_template_id')->references('id')->on('design_templates')->onDelete('cascade');
                $table->index('design_template_id');
            });
        }

        // Backfill existing template category assignments
        $templates = DB::table('design_templates')->select('id', 'category', 'product_id')->get();
        $allCategories = DB::table('categories')->get(['id', 'name', 'slug']);

        foreach ($templates as $template) {
            $assignedCategoryId = null;

            // Attempt to match category by name or slug from existing string category
            if (!empty($template->category)) {
                $matchedCat = $allCategories->first(function ($cat) use ($template) {
                    return strcasecmp($cat->name, $template->category) === 0
                        || strcasecmp($cat->slug, $template->category) === 0;
                });
                if ($matchedCat) {
                    $assignedCategoryId = $matchedCat->id;
                }
            }

            // Fallback: inherit category from associated product if available
            if (!$assignedCategoryId && !empty($template->product_id)) {
                $prod = DB::table('products')->where('id', $template->product_id)->first(['category_id']);
                if ($prod && !empty($prod->category_id)) {
                    $assignedCategoryId = $prod->category_id;
                }
            }

            // Fallback: if there is any category in database, link to it to preserve assignment
            if (!$assignedCategoryId && $allCategories->isNotEmpty()) {
                $assignedCategoryId = $allCategories->first()->id;
            }

            if ($assignedCategoryId) {
                DB::table('category_design_template')->insertOrIgnore([
                    'category_id' => $assignedCategoryId,
                    'design_template_id' => $template->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('category_design_template');
        Schema::dropIfExists('category_product');
    }
};
