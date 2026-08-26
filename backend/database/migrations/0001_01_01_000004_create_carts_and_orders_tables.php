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
        // 1. Carts
        Schema::create('carts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('session_id')->nullable()->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->char('currency', 3)->default('AUD');
            $table->timestamps();
        });

        // 2. Cart Items
        Schema::create('cart_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cart_id');
            $table->uuid('product_id');
            $table->integer('quantity');
            $table->json('selected_options')->comment('Map of attribute codes/IDs to selected values');
            $table->uuid('artwork_id')->nullable();
            $table->json('design_canvas_json')->nullable();
            $table->decimal('unit_price_ex_gst', 10, 4);
            $table->decimal('subtotal_ex_gst', 10, 2);
            $table->decimal('gst_amount', 10, 2);
            $table->decimal('total_inc_gst', 10, 2);
            $table->timestamps();

            $table->foreign('cart_id')->references('id')->on('carts')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('artwork_id')->references('id')->on('artworks')->onDelete('set null');
        });

        // 3. Orders
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('order_number')->unique()->comment('e.g. PO-2026-10023');
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->string('status')->default('pending_payment')->comment('pending_payment, processing, artwork_required, artwork_review, in_production, dispatched, delivered, cancelled, refunded');
            $table->string('payment_status')->default('unpaid')->comment('unpaid, authorized, paid, failed, refunded');
            $table->decimal('subtotal_ex_gst', 10, 2);
            $table->decimal('gst_amount', 10, 2)->comment('10% n GST');
            $table->decimal('shipping_fee_inc_gst', 10, 2)->default(0.00);
            $table->decimal('discount_amount', 10, 2)->default(0.00);
            $table->decimal('total_inc_gst', 10, 2);
            $table->char('currency', 3)->default('AUD');
            $table->json('shipping_address');
            $table->json('billing_address');
            $table->string('shipping_carrier')->nullable()->comment(' Post, StarTrack, TNT, etc.');
            $table->string('tracking_number')->nullable();
            $table->text('customer_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('order_number');
        });

        // 4. Order Line Items
        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->uuid('product_id');
            $table->string('product_name');
            $table->string('product_sku');
            $table->integer('quantity');
            $table->decimal('unit_price_ex_gst', 10, 4);
            $table->decimal('unit_price_inc_gst', 10, 4);
            $table->decimal('total_price_inc_gst', 10, 2);
            $table->json('options_snapshot')->comment('Frozen snapshot of selected attributes');
            $table->uuid('artwork_id')->nullable();
            $table->json('designer_canvas_state')->nullable();
            $table->string('production_status')->default('queued')->comment('queued, prepress, printing, finishing, packaging, completed');
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('restrict');
            $table->foreign('artwork_id')->references('id')->on('artworks')->onDelete('set null');
            $table->index(['order_id', 'production_status']);
        });

        // 5. Payment Transactions
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->string('gateway')->comment('stripe, square, bank_transfer, afterpay');
            $table->string('transaction_id')->nullable()->index();
            $table->decimal('amount', 10, 2);
            $table->char('currency', 3)->default('AUD');
            $table->string('status')->default('pending')->comment('pending, succeeded, failed, refunded');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });

        // 6. n Tax Invoices
        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->string('invoice_number')->unique()->comment('e.g. INV-2026-08129');
            $table->string('pdf_path')->nullable();
            $table->string('status')->default('issued')->comment('draft, issued, paid, void');
            $table->date('issued_at');
            $table->date('due_at')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
    }
};
