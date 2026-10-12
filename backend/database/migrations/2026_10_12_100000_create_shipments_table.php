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
        if (!Schema::hasTable('shipments')) {
            Schema::create('shipments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('order_id');
                $table->string('carrier')->default('CouriersPlease');
                $table->string('consignment_code')->index();
                $table->string('reference_number')->nullable()->index();
                $table->string('job_number')->nullable();
                $table->string('rate_card_id')->nullable();
                $table->string('rate_card_description')->nullable();
                $table->decimal('freight_charge', 10, 2)->default(0.00);
                $table->decimal('fuel_charge', 10, 2)->default(0.00);
                $table->decimal('gst_charge', 10, 2)->default(0.00);
                $table->decimal('total_charge', 10, 2)->default(0.00);
                $table->string('label_url', 500)->nullable();
                $table->string('label_path', 500)->nullable();
                $table->string('status')->default('created')->index(); // created, manifest, in_transit, out_for_delivery, delivered, cancelled
                $table->json('tracking_data')->nullable();
                $table->json('request_payload')->nullable();
                $table->json('response_payload')->nullable();
                $table->timestamp('shipped_at')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->timestamps();

                $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
                $table->index(['order_id', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
