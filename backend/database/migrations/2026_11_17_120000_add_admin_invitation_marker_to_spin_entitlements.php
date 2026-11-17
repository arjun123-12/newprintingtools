<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_spin_entitlements', function (Blueprint $table) {
            $table->timestamp('invited_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('order_spin_entitlements', function (Blueprint $table) {
            $table->dropColumn('invited_at');
        });
    }
};
