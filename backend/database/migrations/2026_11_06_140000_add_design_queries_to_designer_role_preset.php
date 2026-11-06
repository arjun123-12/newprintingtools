<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $preset = DB::table('role_presets')->where('slug', 'designer')->first();
        if (!$preset) {
            return;
        }

        $permissions = json_decode($preset->permissions, true) ?: [];
        if (!in_array('design_queries', $permissions, true)) {
            $permissions[] = 'design_queries';
            DB::table('role_presets')->where('id', $preset->id)->update([
                'permissions' => json_encode($permissions),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $preset = DB::table('role_presets')->where('slug', 'designer')->first();
        if (!$preset) {
            return;
        }

        $permissions = json_decode($preset->permissions, true) ?: [];
        $permissions = array_values(array_filter($permissions, fn ($permission) => $permission !== 'design_queries'));
        DB::table('role_presets')->where('id', $preset->id)->update([
            'permissions' => json_encode($permissions),
            'updated_at' => now(),
        ]);
    }
};
