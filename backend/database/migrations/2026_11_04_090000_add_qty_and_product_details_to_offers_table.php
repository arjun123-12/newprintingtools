<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            if (!Schema::hasColumn('offers', 'quantity')) {
                $table->unsignedInteger('quantity')->nullable()->after('minimum_subtotal');
            }
            if (!Schema::hasColumn('offers', 'product_details')) {
                $table->text('product_details')->nullable()->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            if (Schema::hasColumn('offers', 'product_details')) {
                $table->dropColumn('product_details');
            }
            if (Schema::hasColumn('offers', 'quantity')) {
                $table->dropColumn('quantity');
            }
        });
    }
};

