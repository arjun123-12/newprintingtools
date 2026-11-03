<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'marketing_consent')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('marketing_consent')->default(false)->index();
                $table->timestamp('marketing_consent_at')->nullable();
                $table->timestamp('marketing_unsubscribed_at')->nullable();
            });
        }

        if (!Schema::hasTable('offers')) {
            Schema::create('offers', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 40)->unique();
                $table->enum('discount_type', ['percentage', 'fixed']);
                $table->decimal('discount_value', 10, 2);
                $table->decimal('minimum_subtotal', 10, 2)->default(0);
                $table->decimal('maximum_discount', 10, 2)->nullable();
                $table->unsignedInteger('usage_limit')->nullable();
                $table->unsignedInteger('usage_count')->default(0);
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->string('status')->default('draft')->index();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('offer_campaigns')) {
            Schema::create('offer_campaigns', function (Blueprint $table) {
                $table->id();
                $table->foreignId('offer_id')->constrained()->cascadeOnDelete();
                $table->string('subject');
                $table->string('headline');
                $table->text('message');
                $table->string('status')->default('draft')->index();
                $table->unsignedInteger('recipient_count')->default(0);
                $table->unsignedInteger('sent_count')->default(0);
                $table->unsignedInteger('failed_count')->default(0);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('sent_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('offer_campaign_recipients')) {
            Schema::create('offer_campaign_recipients', function (Blueprint $table) {
                $table->id();
                $table->foreignId('campaign_id')->constrained('offer_campaigns')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('email')->index();
                $table->string('unsubscribe_token_hash', 64)->unique();
                $table->string('status')->default('queued')->index();
                $table->text('error')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamps();
                $table->unique(['campaign_id', 'email']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offer_campaign_recipients');
        Schema::dropIfExists('offer_campaigns');
        Schema::dropIfExists('offers');
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'marketing_consent')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn(['marketing_consent', 'marketing_consent_at', 'marketing_unsubscribed_at']);
            });
        }
    }
};
