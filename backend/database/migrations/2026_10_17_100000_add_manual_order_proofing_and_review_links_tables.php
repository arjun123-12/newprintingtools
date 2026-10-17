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
        // 1. Add delivery method and proof version tracking columns to orders table
        Schema::table('orders', function (Blueprint $table) {
            $table->string('delivery_method')->nullable()->after('currency');
            $table->unsignedInteger('current_proof_version')->default(1)->after('admin_notes');
            $table->unsignedInteger('approved_proof_version')->nullable()->after('current_proof_version');
            $table->timestamp('proof_approved_at')->nullable()->after('approved_proof_version');
            $table->string('proof_approved_by')->nullable()->after('proof_approved_at');
            $table->timestamp('reminder_sent_at')->nullable()->after('proof_approved_by');
        });

        // 2. Add proof_files to artwork_versions table (to support multi-file/front-back proofs)
        Schema::table('artwork_versions', function (Blueprint $table) {
            $table->json('proof_files')->nullable()->after('proof_pdf_url');
        });

        // 3. Create order_review_links table
        Schema::create('order_review_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->string('token', 64)->unique();
            $table->string('token_hash', 64)->nullable()->index();
            $table->string('status', 32)->default('active'); // active, revoked, expired, completed
            $table->unsignedInteger('open_count')->default(0);
            $table->timestamp('last_opened_at')->nullable();
            $table->string('last_opened_ip', 45)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->index(['order_id', 'status']);
        });

        // 4. Create order_activities table (append-only timeline)
        Schema::create('order_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->string('event_type', 64);
            $table->text('description');
            $table->string('actor_type', 32)->default('system'); // staff, customer, system, payment_gateway
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name', 150)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->index(['order_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_activities');
        Schema::dropIfExists('order_review_links');

        Schema::table('artwork_versions', function (Blueprint $table) {
            $table->dropColumn('proof_files');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_method',
                'current_proof_version',
                'approved_proof_version',
                'proof_approved_at',
                'proof_approved_by',
                'reminder_sent_at',
            ]);
        });
    }
};
