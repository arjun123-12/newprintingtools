<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            if (!Schema::hasColumn('artworks', 'session_id')) {
                $table->string('session_id', 255)
                    ->nullable()
                    ->after('user_id')
                    ->index();
            }

            if (!Schema::hasColumn('artworks', 'template_id')) {
                $table->foreignUuid('template_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('design_templates')
                    ->nullOnDelete();
            }
        });

        // Backfill template_id from design_template_id if present
        if (Schema::hasColumn('artworks', 'design_template_id') && Schema::hasColumn('artworks', 'template_id')) {
            DB::statement('UPDATE artworks SET template_id = design_template_id WHERE template_id IS NULL AND design_template_id IS NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            if (Schema::hasColumn('artworks', 'template_id')) {
                $table->dropForeign(['template_id']);
                $table->dropColumn('template_id');
            }

            if (Schema::hasColumn('artworks', 'session_id')) {
                $table->dropColumn('session_id');
            }
        });
    }
};
