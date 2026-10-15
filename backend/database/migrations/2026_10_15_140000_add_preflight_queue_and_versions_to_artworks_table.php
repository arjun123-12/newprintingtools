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
        // 1. Add review workflow and assignment columns to artworks table
        Schema::table('artworks', function (Blueprint $table) {
            $table->uuid('order_id')->nullable()->after('product_id');
            $table->foreignId('assigned_designer_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->string('review_status', 32)->default('pending_review')->after('design_status')->index();
            $table->foreignId('approved_by')->nullable()->after('review_status')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->string('proof_status', 32)->default('none')->after('proof_pdf_url')->index();
            $table->timestamp('proof_generated_at')->nullable()->after('proof_status');
            $table->unsignedInteger('current_version')->default(1)->after('proof_generated_at');

            // Foreign key to orders
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
            $table->index(['review_status', 'assigned_designer_id']);
        });

        // 2. Table for artwork version history
        Schema::create('artwork_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('artwork_id');
            $table->unsignedInteger('version_number');
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('storage_disk')->default('public');
            $table->string('storage_path')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('proof_pdf_url')->nullable();
            $table->unsignedInteger('width_px')->nullable();
            $table->unsignedInteger('height_px')->nullable();
            $table->unsignedInteger('dpi')->nullable();
            $table->string('color_profile', 64)->nullable();
            $table->json('preflight_results')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('change_summary')->nullable();
            $table->timestamps();

            $table->foreign('artwork_id')->references('id')->on('artworks')->onDelete('cascade');
            $table->unique(['artwork_id', 'version_number']);
        });

        // 3. Table for artwork review events and audit trail
        Schema::create('artwork_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('artwork_id');
            $table->unsignedInteger('version_number')->default(1);
            $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
            $table->string('action', 48); // approved, changes_requested, rejected, proof_generated, designer_assigned, preflight_run
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('artwork_id')->references('id')->on('artworks')->onDelete('cascade');
            $table->index(['artwork_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('artwork_reviews');
        Schema::dropIfExists('artwork_versions');

        Schema::table('artworks', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->dropForeign(['assigned_designer_id']);
            $table->dropForeign(['approved_by']);
            $table->dropIndex(['review_status', 'assigned_designer_id']);

            $table->dropColumn([
                'order_id',
                'assigned_designer_id',
                'review_status',
                'approved_by',
                'approved_at',
                'proof_status',
                'proof_generated_at',
                'current_version',
            ]);
        });
    }
};
