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
        Schema::create('design_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('category_id')->nullable()->constrained('design_asset_categories')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('asset_type'); // text, frame, photo, element, background
            $table->string('file_path')->nullable();
            $table->string('file_url')->nullable();
            $table->string('thumbnail_path')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->json('fabric_json')->nullable();
            $table->json('metadata')->nullable();
            $table->string('provider')->default('admin');
            $table->string('provider_asset_id')->nullable();
            $table->string('license_name')->nullable();
            $table->string('attribution')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            
            $table->index('asset_type');
            $table->index('is_active');
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_assets');
    }
};
