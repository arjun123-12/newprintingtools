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
        Schema::create('customer_enquiries', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            
            // Product context
            $table->string('product_id')->nullable();
            $table->string('product_name')->nullable();
            $table->unsignedInteger('quantity')->nullable();
            
            // Specifications (size, gsm, sides, folding, finishing, etc.)
            $table->json('specifications')->nullable();
            
            // Delivery and notes
            $table->string('delivery_location')->nullable();
            $table->text('additional_requirements')->nullable();
            $table->string('source_url', 1000)->nullable();
            
            // Optional artwork attachment
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->string('attachment_mime_type')->nullable();
            $table->unsignedBigInteger('attachment_size_bytes')->nullable();
            
            // Workflow status & admin management
            $table->string('status')->default('new')->index(); // new, contacted, quoted, converted, closed
            $table->text('admin_notes')->nullable();
            
            // Audit metadata
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_enquiries');
    }
};
