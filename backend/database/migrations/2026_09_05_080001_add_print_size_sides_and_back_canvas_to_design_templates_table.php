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
        Schema::table('design_templates', function (Blueprint $table) {
            $table->string('print_sides', 20)
                ->default('front')
                ->after('category')
                ->comment('front, back, both');

            $table->decimal('width_mm', 10, 2)
                ->nullable()
                ->after('print_sides')
                ->comment('Template finished width in mm');

            $table->decimal('height_mm', 10, 2)
                ->nullable()
                ->after('width_mm')
                ->comment('Template finished height in mm');

            $table->decimal('margin_mm', 10, 2)
                ->default(0)
                ->after('height_mm')
                ->comment('Inside margin guide in mm');

            $table->decimal('bleed_mm', 10, 2)
                ->default(0)
                ->after('margin_mm')
                ->comment('Outside bleed boundary in mm');

            $table->decimal('safe_area_mm', 10, 2)
                ->default(0)
                ->after('bleed_mm')
                ->comment('Inside safety boundary in mm');

            $table->json('back_canvas_json')
                ->nullable()
                ->after('canvas_json')
                ->comment('Serialized back-side canvas layers and objects');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('design_templates', function (Blueprint $table) {
            $table->dropColumn([
                'print_sides',
                'width_mm',
                'height_mm',
                'margin_mm',
                'bleed_mm',
                'safe_area_mm',
                'back_canvas_json',
            ]);
        });
    }
};
