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
        Schema::create('design_template_pages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('design_template_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_side_id')->constrained('product_sides')->cascadeOnDelete();
            $table->longText('canvas_json')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('design_template_pages');
    }
};
