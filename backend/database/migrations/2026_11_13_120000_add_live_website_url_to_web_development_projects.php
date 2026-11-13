<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('web_development_projects', 'live_website_url')) {
            Schema::table('web_development_projects', function (Blueprint $table) {
                $table->string('live_website_url', 2048)->nullable()->after('website_url');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('web_development_projects', 'live_website_url')) {
            Schema::table('web_development_projects', function (Blueprint $table) {
                $table->dropColumn('live_website_url');
            });
        }
    }
};
