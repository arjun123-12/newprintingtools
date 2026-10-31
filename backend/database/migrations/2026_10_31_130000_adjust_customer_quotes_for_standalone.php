<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('customer_quotes')) {
            return;
        }

        if (!Schema::hasColumn('customer_quotes', 'recipient_name')) {
            Schema::table('customer_quotes', function (Blueprint $table) {
                $table->string('recipient_name')->nullable();
            });
        }

        if (!Schema::hasColumn('customer_quotes', 'recipient_email')) {
            Schema::table('customer_quotes', function (Blueprint $table) {
                $table->string('recipient_email')->nullable();
            });
        }

        Schema::table('customer_quotes', function (Blueprint $table) {
            $table->foreignId('customer_enquiry_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Keep quote records intact when rolling back; the fields support data
        // added by the standalone quote workflow.
    }
};
