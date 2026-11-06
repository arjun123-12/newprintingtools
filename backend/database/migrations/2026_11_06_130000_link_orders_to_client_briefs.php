<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('client_brief_id')->nullable()->unique()->constrained('client_briefs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['client_brief_id']);
            $table->dropUnique(['client_brief_id']);
            $table->dropColumn('client_brief_id');
        });
    }
};
