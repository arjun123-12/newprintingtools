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
        // 1. Create spin_reward_categories table
        Schema::create('spin_reward_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('icon', 64)->default('tag');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(1);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
            $table->index('is_default');
        });

        // 2. Add category_id, inventory, and inventory_consumed to spin_rewards
        Schema::table('spin_rewards', function (Blueprint $table) {
            $table->foreignId('category_id')
                ->nullable()
                ->after('id')
                ->constrained('spin_reward_categories')
                ->nullOnDelete();

            $table->integer('inventory')
                ->nullable()
                ->after('probability_weight')
                ->comment('NULL = unlimited inventory, integer >= 0 limited');

            $table->integer('inventory_consumed')
                ->default(0)
                ->after('inventory')
                ->comment('Number of rewards awarded so far');

            $table->index(['category_id', 'is_active']);
        });

        // 3. Add business_category to users table
        Schema::table('users', function (Blueprint $table) {
            $table->string('business_category', 64)
                ->nullable()
                ->after('company_name')
                ->comment('Customer business / industry category for personalized rewards');

            $table->index('business_category');
        });

        // 4. Add business_category snapshot to orders table
        Schema::table('orders', function (Blueprint $table) {
            $table->string('business_category', 64)
                ->nullable()
                ->after('user_id')
                ->comment('Snapshot of customer business category at time of order');

            $table->index('business_category');
        });

        // 5. Add category tracking to customer_reward_ledgers
        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->foreignId('category_id')
                ->nullable()
                ->after('spin_reward_id')
                ->constrained('spin_reward_categories')
                ->nullOnDelete();

            $table->string('category_name', 100)
                ->nullable()
                ->after('category_id')
                ->comment('Snapshot of category name when reward was won');

            $table->index('category_id');
        });

        // 6. Seed Default Category and initial business categories
        $defaultCatId = DB::table('spin_reward_categories')->insertGetId([
            'code' => 'default',
            'name' => 'Default / General',
            'description' => 'Universal fallback rewards applicable to all businesses and general customers.',
            'icon' => 'sparkles',
            'is_default' => true,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed popular industry categories
        DB::table('spin_reward_categories')->insert([
            [
                'code' => 'hospitality',
                'name' => 'Hospitality & Restaurants',
                'description' => 'Tailored for cafes, restaurants, bars, and catering businesses (menus, table talkers, vouchers).',
                'icon' => 'utensils',
                'is_default' => false,
                'is_active' => true,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'real_estate',
                'name' => 'Real Estate & Property',
                'description' => 'Tailored for real estate agents, property managers, and developers (corflutes, property brochures).',
                'icon' => 'home',
                'is_default' => false,
                'is_active' => true,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'retail',
                'name' => 'Retail & E-commerce',
                'description' => 'Tailored for retail boutiques, brands, and online stores (product labels, package inserts, stickers).',
                'icon' => 'shopping-bag',
                'is_default' => false,
                'is_active' => true,
                'sort_order' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'corporate',
                'name' => 'Corporate & Professional',
                'description' => 'Tailored for legal, financial, accounting, and consulting firms (business stationery, presentation folders).',
                'icon' => 'briefcase',
                'is_default' => false,
                'is_active' => true,
                'sort_order' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Migrate all existing rewards to the Default category
        DB::table('spin_rewards')
            ->whereNull('category_id')
            ->update(['category_id' => $defaultCatId]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_reward_ledgers', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn(['category_id', 'category_name']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['business_category']);
            $table->dropColumn('business_category');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['business_category']);
            $table->dropColumn('business_category');
        });

        Schema::table('spin_rewards', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropIndex(['category_id', 'is_active']);
            $table->dropColumn(['category_id', 'inventory', 'inventory_consumed']);
        });

        Schema::dropIfExists('spin_reward_categories');
    }
};
