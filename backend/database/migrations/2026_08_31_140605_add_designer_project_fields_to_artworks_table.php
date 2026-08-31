<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            // Relationships
            $table->foreignUuid('product_id')
                ->nullable()
                ->after('user_id')
                ->constrained('products')
                ->nullOnDelete();

            $table->foreignUuid('design_template_id')
                ->nullable()
                ->after('product_id')
                ->constrained('design_templates')
                ->nullOnDelete();

            // Designer information
            $table->string('name')
                ->nullable()
                ->after('design_template_id');

            $table->enum('source_type', ['upload', 'designer'])
                ->default('upload')
                ->after('name');

            $table->enum('design_status', ['draft', 'completed'])
                ->nullable()
                ->after('source_type');

            // Fabric.js canvas data
            $table->longText('canvas_json')
                ->nullable()
                ->after('design_status');

            $table->json('document_settings')
                ->nullable()
                ->after('canvas_json');

            // Canvas dimensions
            $table->unsignedInteger('width_px')
                ->nullable()
                ->after('document_settings');

            $table->unsignedInteger('height_px')
                ->nullable()
                ->after('width_px');

            $table->unsignedInteger('dpi')
                ->nullable()
                ->after('height_px');

            // Draft designs may not have exported files yet
            $table->string('file_name')
                ->nullable()
                ->change();

            $table->unsignedBigInteger('file_size_bytes')
                ->nullable()
                ->change();

            $table->string('mime_type')
                ->nullable()
                ->change();

            $table->string('storage_path')
                ->nullable()
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['design_template_id']);

            $table->dropColumn([
                'product_id',
                'design_template_id',
                'name',
                'source_type',
                'design_status',
                'canvas_json',
                'document_settings',
                'width_px',
                'height_px',
                'dpi',
            ]);
        });
    }
};