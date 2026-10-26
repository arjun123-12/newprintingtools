<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('turnaround_duration_value')->nullable()->after('production_days');
            $table->string('turnaround_duration_unit', 20)->nullable()->after('turnaround_duration_value'); // 'hours', 'days'
            $table->string('turnaround_day_type', 20)->default('business')->after('turnaround_duration_unit'); // 'business', 'calendar'
            $table->timestamp('turnaround_started_at')->nullable()->after('turnaround_day_type');
            $table->timestamp('estimated_completion_at')->nullable()->after('turnaround_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'turnaround_duration_value',
                'turnaround_duration_unit',
                'turnaround_day_type',
                'turnaround_started_at',
                'estimated_completion_at',
            ]);
        });
    }
};
