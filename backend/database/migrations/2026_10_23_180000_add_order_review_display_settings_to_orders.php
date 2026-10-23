<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('order_cutoff_time', 5)->nullable();
            $table->string('order_cutoff_timezone', 64)->nullable();
            $table->unsignedTinyInteger('proof_watermark_opacity')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'order_cutoff_time',
                'order_cutoff_timezone',
                'proof_watermark_opacity',
            ]);
        });
    }
};
