<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('parent_id')->nullable();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('categories')->onDelete('set null');
            $table->index('is_active');
        });

        // 2. Dynamic Products
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('category_id');
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku')->unique();
            $table->string('short_description')->nullable();
            $table->longText('description')->nullable();
            $table->string('product_type')->default('standard_print')->comment('standard_print, custom_dimension, apparel, signage, stationery');
            $table->integer('min_quantity')->default(1);
            $table->integer('turnaround_days')->default(3)->comment('Standard turnaround time in business days');
            $table->boolean('is_active')->default(true);
            $table->string('featured_image_url')->nullable();
            $table->json('gallery_images')->nullable();
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->onDelete('restrict');
            $table->index(['category_id', 'is_active']);
        });

        // 3. Dynamic Product Attributes (Size, Paper Stock, Lamination, Orientation, etc.)
        Schema::create('product_attributes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->string('name');
            $table->string('code')->comment('e.g. paper_stock, lamination, orientation, custom_size');
            $table->enum('type', ['select', 'radio', 'color', 'custom_dimensions'])->default('select');
            $table->boolean('is_required')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->index(['product_id', 'sort_order']);
        });

        // 4. Attribute Values (Choices & Cost Modifiers)
        Schema::create('product_attribute_values', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_attribute_id');
            $table->string('label');
            $table->string('value');
            $table->text('description')->nullable();
            $table->enum('price_modifier_type', ['fixed', 'percentage', 'multiplier'])->default('fixed');
            $table->decimal('price_modifier_amount', 10, 4)->default(0.0000);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('product_attribute_id')->references('id')->on('product_attributes')->onDelete('cascade');
            $table->index(['product_attribute_id', 'sort_order']);
        });

        // 5. Product Print Area & Bleed Specifications
        Schema::create('product_print_areas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->string('name')->default('Front Side')->comment('Front Side, Back Side, Exterior, Interior');
            $table->decimal('width_mm', 8, 2);
            $table->decimal('height_mm', 8, 2);
            $table->decimal('bleed_mm', 5, 2)->default(2.00)->comment('Bleed margin in mm');
            $table->decimal('safe_zone_mm', 5, 2)->default(3.00)->comment('Safe margin in mm');
            $table->string('cut_line_color', 10)->default('#FF0000');
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 6. Pricing Matrices (Volume Tier Breaks & Setup Costs)
        Schema::create('pricing_matrices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->integer('quantity')->comment('Tiered quantity breaks e.g. 250, 500, 1000, 2500, 5000');
            $table->decimal('unit_price_ex_gst', 10, 4);
            $table->decimal('setup_fee', 8, 2)->default(0.00);
            $table->decimal('discount_percentage', 5, 2)->default(0.00);
            $table->json('option_pricing_overrides')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->unique(['product_id', 'quantity']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pricing_matrices');
        Schema::dropIfExists('product_print_areas');
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('product_attributes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
