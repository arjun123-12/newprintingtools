<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_brief_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_brief_id')->constrained('client_briefs')->cascadeOnDelete();
            $table->string('author')->default('customer');
            $table->longText('message');
            $table->timestamps();
            $table->index(['client_brief_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_brief_messages');
    }
};
