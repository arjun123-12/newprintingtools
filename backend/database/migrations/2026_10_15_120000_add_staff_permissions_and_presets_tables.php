<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add staff permissions and security columns to users table
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_super_admin')->default(false)->after('role')->index();
            $table->boolean('is_active')->default(true)->after('is_super_admin')->index();
            $table->json('permissions')->nullable()->after('is_active');
            $table->string('role_preset', 50)->nullable()->after('permissions');
            $table->boolean('must_change_password')->default(false)->after('role_preset');
        });

        // 2. Preserve existing administrators by setting is_super_admin = true
        // and ensuring they have full access
        DB::table('users')
            ->where('role', 'admin')
            ->update([
                'is_super_admin' => true,
                'is_active' => true,
                'must_change_password' => false,
            ]);

        // 3. Create role presets table for reusable permissions templates
        Schema::create('role_presets', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 50)->unique();
            $table->text('description')->nullable();
            $table->json('permissions');
            $table->boolean('is_system')->default(true);
            $table->timestamps();
        });

        // 4. Seed initial production role presets
        $presets = [
            [
                'name' => 'Designer',
                'slug' => 'designer',
                'description' => 'Access to design templates, graphic asset libraries, and the artwork preflight queue.',
                'permissions' => json_encode([
                    'templates',
                    'design_assets',
                    'artwork',
                ]),
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Product Manager',
                'slug' => 'product_manager',
                'description' => 'Manage the print product catalog, categories, specifications, and pricing matrix.',
                'permissions' => json_encode([
                    'products',
                    'categories',
                    'pricing',
                ]),
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Operations Manager',
                'slug' => 'operations',
                'description' => 'Handle order fulfillment, preflight artwork checks, invoicing, customer queries, and shipping.',
                'permissions' => json_encode([
                    'dashboard',
                    'orders',
                    'invoices',
                    'shipping',
                    'artwork',
                    'enquiries',
                ]),
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Customer Support',
                'slug' => 'support',
                'description' => 'Review customer details, handle incoming enquiries, and view order delivery statuses.',
                'permissions' => json_encode([
                    'dashboard',
                    'orders',
                    'customers',
                    'enquiries',
                ]),
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Administrator',
                'slug' => 'administrator',
                'description' => 'Broad administrative access across all operational, catalog, design, and financial sections.',
                'permissions' => json_encode([
                    'dashboard',
                    'orders',
                    'enquiries',
                    'products',
                    'categories',
                    'templates',
                    'design_assets',
                    'artwork',
                    'customers',
                    'pricing',
                    'invoices',
                    'shipping',
                    'reports',
                    'settings',
                ]),
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('role_presets')->insert($presets);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_presets');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['is_super_admin']);
            $table->dropIndex(['is_active']);
            $table->dropColumn([
                'is_super_admin',
                'is_active',
                'permissions',
                'role_preset',
                'must_change_password',
            ]);
        });
    }
};
