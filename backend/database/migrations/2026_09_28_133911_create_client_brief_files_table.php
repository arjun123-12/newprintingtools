<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_brief_files', function (Blueprint $table) {
            $table->id();

            $table->foreignId('client_brief_id')
                ->constrained('client_briefs')
                ->cascadeOnDelete();

            $table->string('file_type')->default('attachment');

            $table->string('original_name');
            $table->string('file_path');

            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);

            $table->timestamps();

            $table->index([
                'client_brief_id',
                'file_type',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_brief_files');
    }
};