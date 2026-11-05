<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_spin_entitlements', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->uuid('order_id')->nullable()->change();
            $table->string('email')->nullable()->after('user_id');
            $table->string('name')->nullable()->after('email');
            $table->foreignId('assigned_reward_id')->nullable()->after('name')->constrained('spin_rewards')->nullOnDelete();
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });

        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->uuid('order_id')->nullable()->change();
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->uuid('order_id')->nullable(false)->change();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
        });

        Schema::table('order_spin_entitlements', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->dropForeign(['assigned_reward_id']);
            $table->dropColumn(['email', 'name', 'assigned_reward_id']);
            $table->uuid('order_id')->nullable(false)->change();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
        });
    }
};
