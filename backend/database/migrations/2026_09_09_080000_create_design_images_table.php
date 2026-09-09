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
        Schema::create('design_images', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('session_id', 255)->nullable()->index();
            $table->string('file_name', 255);
            $table->string('original_path', 1000);
            $table->string('preview_path', 1000)->nullable();
            $table->string('upscaled_path', 1000)->nullable();
            $table->string('file_checksum', 64)->index();
            $table->unsignedInteger('original_width')->default(0);
            $table->unsignedInteger('original_height')->default(0);
            $table->unsignedInteger('upscaled_width')->nullable();
            $table->unsignedInteger('upscaled_height')->nullable();
            $table->decimal('effective_dpi', 8, 2)->nullable();
            $table->unsignedInteger('target_dpi')->default(300);
            $table->unsignedTinyInteger('upscale_factor')->default(1);
            $table->string('upscale_status', 32)->default('not_required')->index();
            $table->text('upscale_error')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('source_provider', 100)->nullable();
            $table->string('source_asset_id', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_images');
    }
};
