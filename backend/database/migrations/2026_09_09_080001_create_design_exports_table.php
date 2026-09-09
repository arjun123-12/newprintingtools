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
        Schema::create('design_exports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('session_id', 255)->nullable()->index();
            $table->uuid('artwork_id')->nullable()->index();
            $table->string('status', 32)->default('pending')->index();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->string('format', 32)->default('png');
            $table->string('quality_preset', 32)->default('print');
            $table->unsignedInteger('target_dpi')->default(300);
            $table->boolean('include_normal')->default(false);
            $table->boolean('include_enhanced')->default(true);
            $table->string('file_path', 1000)->nullable();
            $table->string('file_name', 255)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->json('report')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_exports');
    }
};
