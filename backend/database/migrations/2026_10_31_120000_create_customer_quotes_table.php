<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_enquiry_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_email');
            $table->uuid('order_id')->nullable()->unique();
            $table->string('quote_number')->unique();
            $table->char('token_hash', 64)->unique();
            $table->json('items');
            $table->string('delivery_method')->nullable();
            $table->string('delivery_address')->nullable();
            $table->text('terms')->nullable();
            $table->string('currency', 3)->default('AUD');
            $table->decimal('subtotal_ex_gst', 12, 2)->default(0);
            $table->decimal('shipping_fee_inc_gst', 12, 2)->default(0);
            $table->decimal('gst_amount', 12, 2)->default(0);
            $table->decimal('total_inc_gst', 12, 2)->default(0);
            $table->string('status')->default('draft')->index();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamps();
        });

        Schema::table('customer_quotes', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_quotes');
    }
};
