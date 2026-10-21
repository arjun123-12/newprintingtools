<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customer_enquiries', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_enquiries', 'access_token')) {
                $table->string('access_token', 64)->nullable()->unique()->after('reference');
            }
            if (!Schema::hasColumn('customer_enquiries', 'last_message_at')) {
                $table->timestamp('last_message_at')->nullable()->after('status');
            }
        });

        // Ensure all existing enquiries have a secure unguessable access_token
        $enquiries = DB::table('customer_enquiries')->whereNull('access_token')->get();
        foreach ($enquiries as $enq) {
            DB::table('customer_enquiries')
                ->where('id', $enq->id)
                ->update(['access_token' => bin2hex(random_bytes(32))]);
        }

        Schema::create('customer_enquiry_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_enquiry_id')->constrained('customer_enquiries')->cascadeOnDelete();
            $table->string('sender_type', 20)->index(); // 'customer' or 'admin'
            $table->string('sender_name')->nullable();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('message');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->string('attachment_mime_type')->nullable();
            $table->unsignedBigInteger('attachment_size_bytes')->nullable();
            $table->boolean('is_read_by_admin')->default(false);
            $table->boolean('is_read_by_customer')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_enquiry_messages');

        Schema::table('customer_enquiries', function (Blueprint $table) {
            if (Schema::hasColumn('customer_enquiries', 'access_token')) {
                $table->dropColumn('access_token');
            }
            if (Schema::hasColumn('customer_enquiries', 'last_message_at')) {
                $table->dropColumn('last_message_at');
            }
        });
    }
};
