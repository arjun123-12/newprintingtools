<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->string('unit', 10)
                ->default('mm')
                ->after('dpi')
                ->comment('Document unit: mm, px, in');

            $table->decimal('bleed', 6, 2)
                ->nullable()
                ->after('unit')
                ->comment('Bleed area in document units');

            $table->decimal('safe_area', 6, 2)
                ->nullable()
                ->after('bleed')
                ->comment('Safe area margin in document units');

            $table->string('background_color', 20)
                ->default('#ffffff')
                ->after('safe_area')
                ->comment('Canvas background color');
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->dropColumn([
                'unit',
                'bleed',
                'safe_area',
                'background_color',
            ]);
        });
    }
};
