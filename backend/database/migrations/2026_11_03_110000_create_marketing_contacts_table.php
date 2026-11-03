<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('marketing_contacts')) {
            Schema::create('marketing_contacts', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->boolean('marketing_consent')->default(false)->index();
                $table->timestamp('marketing_consent_at')->nullable();
                $table->timestamp('unsubscribed_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('offer_campaign_recipients') && !Schema::hasColumn('offer_campaign_recipients', 'marketing_contact_id')) {
            Schema::table('offer_campaign_recipients', function (Blueprint $table) {
                $table->foreignId('marketing_contact_id')
                    ->nullable()
                    ->after('user_id')
                    ->constrained('marketing_contacts')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('offer_campaign_recipients') && Schema::hasColumn('offer_campaign_recipients', 'marketing_contact_id')) {
            Schema::table('offer_campaign_recipients', function (Blueprint $table) {
                $table->dropForeign(['marketing_contact_id']);
                $table->dropColumn('marketing_contact_id');
            });
        }

        Schema::dropIfExists('marketing_contacts');
    }
};

