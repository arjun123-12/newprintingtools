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
        // 1. Configured Spin & Win wheel reward segments
        Schema::create('spin_rewards', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title');
            $table->string('reward_type', 32)->comment('print_credit, free_product, premium_upgrade, shipping_upgrade');
            $table->string('badge_text', 32)->nullable()->comment('e.g. FREE, $25, $10, $20');
            $table->decimal('value', 10, 2)->default(0.00);
            $table->text('description')->nullable();
            $table->text('terms_text');
            $table->text('how_to_use');
            $table->string('color_bg', 32)->default('#fef08a');
            $table->string('color_text', 32)->default('#0f172a');
            $table->string('icon', 32)->default('gift');
            $table->integer('probability_weight')->default(10);
            $table->decimal('min_order_spend', 10, 2)->default(0.00);
            $table->integer('expiry_days')->default(90);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(1);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });

        // 2. Spin entitlements per qualifying paid order (UNIQUE constraint per order strictly guarantees max 1 spin)
        Schema::create('order_spin_entitlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->unique()->comment('One spin entitlement per qualifying paid order');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('spin_token', 64)->unique();
            $table->string('status', 32)->default('eligible')->comment('eligible, spun, expired, ineligible');
            $table->timestamp('spun_at')->nullable();
            $table->string('client_ip', 64)->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->index(['status', 'order_id']);
        });

        // 3. Durable customer reward ledger (linked to order, entitlement, user, and unique claimable voucher code)
        Schema::create('customer_reward_ledgers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('entitlement_id')->unique()->comment('Strict 1:1 relation with spin entitlement');
            $table->uuid('order_id');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('spin_reward_id')->constrained('spin_rewards')->onDelete('cascade');
            $table->string('reward_code', 32)->unique()->comment('e.g. SPIN-4K9X-2M8P');
            $table->string('reward_type', 32)->comment('print_credit, free_product, premium_upgrade, shipping_upgrade');
            $table->string('title');
            $table->string('badge_text', 32)->nullable();
            $table->decimal('value', 10, 2)->default(0.00);
            $table->text('terms');
            $table->text('how_to_use');
            $table->timestamp('expires_at');
            $table->string('status', 32)->default('active')->comment('active, redeemed, expired');
            $table->timestamp('redeemed_at')->nullable();
            $table->uuid('redeemed_order_id')->nullable();
            $table->string('claim_token', 64)->nullable()->unique();
            $table->timestamps();

            $table->foreign('entitlement_id')->references('id')->on('order_spin_entitlements')->onDelete('cascade');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->foreign('redeemed_order_id')->references('id')->on('orders')->nullOnDelete();
            $table->index(['user_id', 'status']);
            $table->index(['reward_code', 'status']);
        });

        // 4. Spin & Win platform configuration
        Schema::create('spin_win_settings', function (Blueprint $table) {
            $table->string('key', 64)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spin_win_settings');
        Schema::dropIfExists('customer_reward_ledgers');
        Schema::dropIfExists('order_spin_entitlements');
        Schema::dropIfExists('spin_rewards');
    }
};
