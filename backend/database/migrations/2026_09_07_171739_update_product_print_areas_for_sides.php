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
        Schema::table('product_print_areas', function (Blueprint $table) {
            $table->foreignUuid('product_side_id')->nullable()->constrained('product_sides')->cascadeOnDelete();
            $table->string('side', 50)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_print_areas', function (Blueprint $table) {
            $table->dropForeign(['product_side_id']);
            $table->dropColumn('product_side_id');
            $table->string('side', 50)->nullable(false)->change();
        });
    }
};
