<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_briefs', function (Blueprint $table) {
            $table->id();

            // Public/admin identifiers
            $table->uuid('uuid')->unique();
            $table->string('token', 64)->unique();

            // Client details
            $table->string('client_name')->nullable();
            $table->string('company_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();

            // Request
            $table->string('request_type')->default('ready');
            $table->string('reorder_reference')->nullable();

            // Product
            $table->string('project_name')->nullable();
            $table->string('product')->nullable();
            $table->unsignedInteger('quantity')->nullable();

            // Size
            $table->decimal('width', 12, 2)->nullable();
            $table->decimal('height', 12, 2)->nullable();
            $table->string('unit', 10)->default('mm');

            // Printing
            $table->string('print_sides', 20)->default('front');
            $table->string('fulfilment', 30)->default('pickup');
            $table->text('delivery_address')->nullable();

            // Requirements
            $table->text('colours')->nullable();
            $table->longText('description')->nullable();
            $table->longText('additional_notes')->nullable();

            $table->date('requested_date')->nullable();

            // Workflow
            $table->string('status')->default('draft');

            $table->boolean('is_active')->default(true);

            $table->timestamp('expires_at')->nullable();
            $table->timestamp('submitted_at')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('email');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_briefs');
    }
};