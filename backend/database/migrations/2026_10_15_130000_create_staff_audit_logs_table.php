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
        Schema::create('staff_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('actor_name', 255);
            $table->string('actor_email', 255);
            $table->unsignedBigInteger('affected_user_id')->nullable()->index();
            $table->string('affected_user_name', 255)->nullable();
            $table->string('affected_user_email', 255)->nullable();
            $table->string('action', 100)->index(); // staff_created, staff_updated, staff_deactivated, staff_activated, staff_deleted, preset_created, preset_updated, preset_deleted
            $table->json('details')->nullable(); // Changes diff (e.g. added/removed permissions, role changes). Never passwords or tokens.
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
        Schema::dropIfExists('staff_audit_logs');
    }
};
