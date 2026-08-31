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
        Schema::table('products', function (Blueprint $table) {

            // Pricing
            $table->decimal('base_price', 10, 2)
                ->nullable()
                ->after('turnaround_days');

            $table->decimal('sale_price', 10, 2)
                ->nullable()
                ->after('base_price');

            $table->decimal('cost_price', 10, 2)
                ->nullable()
                ->after('sale_price');

            // Product status
            $table->string('status', 50)
                ->default('draft')
                ->after('gallery_images');

            $table->boolean('is_featured')
                ->default(false)
                ->after('is_active');

            // Design options
            $table->boolean('allow_custom_design')
                ->default(true)
                ->after('is_featured');

            $table->boolean('allow_customer_upload')
                ->default(true)
                ->after('allow_custom_design');

            // SEO
            $table->string('meta_title')
                ->nullable()
                ->after('allow_customer_upload');

            $table->text('meta_description')
                ->nullable()
                ->after('meta_title');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'base_price',
                'sale_price',
                'cost_price',
                'status',
                'is_featured',
                'allow_custom_design',
                'allow_customer_upload',
                'meta_title',
                'meta_description',
            ]);
        });
    }
    
};
