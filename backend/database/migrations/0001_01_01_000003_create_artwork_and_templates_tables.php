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
        // 1. Artwork Metadata & Storage Registry (Cloudflare R2 / S3 keys)
        Schema::create('artworks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('file_name');
            $table->unsignedBigInteger('file_size_bytes');
            $table->string('mime_type');
            $table->string('storage_disk')->default('r2')->comment('r2, s3, local');
            $table->string('storage_path')->comment('Object key in Cloudflare R2 / S3');
            $table->string('public_url')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('proof_pdf_url')->nullable();
            $table->enum('status', [
                'uploaded',
                'preflight_passed',
                'preflight_warning',
                'preflight_failed',
                'customer_approved',
                'ready_for_production',
                'rejected'
            ])->default('uploaded');
            $table->json('preflight_results')->nullable()->comment('DPI, CMYK check, Bleed detection metrics');
            $table->text('customer_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        // 2. Design Templates for Online Designer Studio
        Schema::create('design_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->string('name');
            $table->string('category')->nullable();
            $table->json('canvas_json')->comment('Serialized canvas layers and objects');
            $table->string('thumbnail_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->index(['product_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_templates');
        Schema::dropIfExists('artworks');
    }
};
