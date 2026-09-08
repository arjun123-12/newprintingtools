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
        Schema::create('product_sides', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('side_number');
            $table->string('name')->comment('e.g., Front, Back, Inside Left');
            $table->string('type')->default('front')->comment('front, back, inside, etc.');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            
            // Background Configuration
            $table->string('background_color')->nullable();
            $table->string('background_image_url')->nullable();
            
            // Media
            $table->string('preview_image_url')->nullable();
            $table->string('mockup_image_url')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_sides');
    }
};
