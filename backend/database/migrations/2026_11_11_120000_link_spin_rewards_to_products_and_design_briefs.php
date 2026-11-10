<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_rewards', function (Blueprint $table) {
            $table->string('target_product')->nullable()->after('reward_type');
        });
        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->string('target_product')->nullable()->after('reward_type');
        });
        Schema::table('client_briefs', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('token')->constrained('users')->nullOnDelete();
            $table->uuid('spin_reward_ledger_id')->nullable()->after('user_id');
            $table->foreign('spin_reward_ledger_id')->references('id')->on('customer_reward_ledgers')->nullOnDelete();
            $table->decimal('design_fee', 10, 2)->default(0)->after('submitted_at');
            $table->timestamp('design_fee_accepted_at')->nullable()->after('design_fee');
        });
    }

    public function down(): void
    {
        Schema::table('client_briefs', function (Blueprint $table) {
            $table->dropForeign(['spin_reward_ledger_id']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['spin_reward_ledger_id', 'design_fee', 'design_fee_accepted_at']);
        });
        Schema::table('customer_reward_ledgers', fn (Blueprint $table) => $table->dropColumn('target_product'));
        Schema::table('spin_rewards', fn (Blueprint $table) => $table->dropColumn('target_product'));
    }
};
