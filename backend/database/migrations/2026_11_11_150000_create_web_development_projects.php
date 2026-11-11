<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('web_development_projects', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('client_name');
            $table->string('company_name')->nullable();
            $table->string('email');
            $table->string('phone', 50)->nullable();
            $table->string('project_name');
            $table->json('services');
            $table->string('website_type', 80)->nullable();
            $table->text('reference_urls')->nullable();
            $table->longText('requirements');
            $table->string('budget_range', 80)->nullable();
            $table->json('infrastructure')->nullable();
            $table->date('requested_deadline')->nullable();
            $table->string('status', 30)->default('new');
            $table->decimal('quote_amount', 10, 2)->nullable();
            $table->text('quote_scope')->nullable();
            $table->timestamp('quote_accepted_at')->nullable();
            $table->json('milestones')->nullable();
            $table->json('hosting_details')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
            $table->index('email');
        });

        Schema::create('web_project_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('web_development_projects')->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('author_type', 20); // customer, developer, admin
            $table->text('message');
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
        });

        Schema::create('web_project_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('web_development_projects')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_name');
            $table->string('file_path');
            $table->string('mime_type', 150)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('web_project_files');
        Schema::dropIfExists('web_project_messages');
        Schema::dropIfExists('web_development_projects');
    }
};
