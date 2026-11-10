<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('applied_reward_code')->nullable()->after('discount_amount');
            $table->string('applied_reward_title')->nullable()->after('applied_reward_code');
            $table->string('applied_reward_type')->nullable()->after('applied_reward_title');
        });

        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->timestamp('expiry_reminder_sent_at')->nullable()->after('reward_email_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->dropColumn('expiry_reminder_sent_at');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['applied_reward_code', 'applied_reward_title', 'applied_reward_type']);
        });
    }
};
