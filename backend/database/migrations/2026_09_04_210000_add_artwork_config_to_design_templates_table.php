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
        if (Schema::hasTable('design_templates') && !Schema::hasColumn('design_templates', 'artwork_config')) {
            Schema::table('design_templates', function (Blueprint $table) {
                $table->json('artwork_config')->nullable()->after('canvas_json');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('design_templates') && Schema::hasColumn('design_templates', 'artwork_config')) {
            Schema::table('design_templates', function (Blueprint $table) {
                $table->dropColumn('artwork_config');
            });
        }
    }
};
