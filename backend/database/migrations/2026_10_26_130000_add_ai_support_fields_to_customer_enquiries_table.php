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
        Schema::table('customer_enquiries', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_enquiries', 'session_id')) {
                $table->string('session_id', 100)->nullable()->index()->after('access_token');
            }
            if (!Schema::hasColumn('customer_enquiries', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('session_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('customer_enquiries', 'channel')) {
                $table->string('channel', 30)->default('web_chat')->index()->after('user_id');
            }
            if (!Schema::hasColumn('customer_enquiries', 'needs_human_followup')) {
                $table->boolean('needs_human_followup')->default(false)->index()->after('status');
            }
            if (!Schema::hasColumn('customer_enquiries', 'is_ai_enabled')) {
                $table->boolean('is_ai_enabled')->default(true)->after('needs_human_followup');
            }
            if (!Schema::hasColumn('customer_enquiries', 'ai_summary')) {
                $table->text('ai_summary')->nullable()->after('is_ai_enabled');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_enquiries', function (Blueprint $table) {
            $columnsToDrop = [];
            foreach (['session_id', 'user_id', 'channel', 'needs_human_followup', 'is_ai_enabled', 'ai_summary'] as $column) {
                if (Schema::hasColumn('customer_enquiries', $column)) {
                    $columnsToDrop[] = $column;
                }
            }
            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
