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
            $table->string('side', 50)->default('front')->after('name');
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->string('side', 50)->default('front')->after('alt_text');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_print_areas', function (Blueprint $table) {
            $table->dropColumn('side');
        });

        Schema::table('product_images', function (Blueprint $table) {
            $table->dropColumn('side');
        });
    }
};
