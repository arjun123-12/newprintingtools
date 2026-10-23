<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RoleAndUserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Super Admin Account (Primary - Matches frontend prefilled login)
        $admin = User::updateOrCreate(
            ['email' => 'admin@printecommerce.com.au'],
            [
                'name' => 'Erry Imprints Admin',
                'phone' => '1300 000 789',
                'company_name' => 'Erry Imprints Pvt Ltd',
                'abn' => '12345678901',
                'role' => 'admin',
                'is_super_admin' => true,
                'is_active' => true,
                'must_change_password' => false,
                'password' => 'SecretAdmin2026!',
                'email_verified_at' => now(),
            ]
        );

        // 1b. Standard Admin Account (admin@admin.com / password)
        User::updateOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'System Administrator',
                'phone' => '1300 000 111',
                'company_name' => 'Print Ecommerce Admin',
                'abn' => '12345678901',
                'role' => 'admin',
                'is_super_admin' => true,
                'is_active' => true,
                'must_change_password' => false,
                'password' => 'password',
                'email_verified_at' => now(),
            ]
        );

        // 1c. Standard Admin Account (admin@example.com / admin123)
        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'phone' => '0400 000 000',
                'company_name' => 'Print Admin Portal',
                'role' => 'admin',
                'is_super_admin' => true,
                'is_active' => true,
                'must_change_password' => false,
                'password' => 'admin123',
                'email_verified_at' => now(),
            ]
        );

        // 2. Prepress Operator
        User::updateOrCreate(
            ['email' => 'prepress@printecommerce.com.au'],
            [
                'name' => 'Jack Henderson',
                'phone' => '0400 111 222',
                'company_name' => 'Print Ecommerce ',
                'role' => 'prepress_operator',
                'password' => 'PrepressPass2026!',
                'email_verified_at' => now(),
            ]
        );

        // 3. Sample Customer with an Address
        $customer = User::updateOrCreate(
            ['email' => 'sarah.miller@sydneymarketing.com.au'],
            [
                'name' => 'Sarah Miller',
                'phone' => '0412 345 678',
                'company_name' => 'Sydney Creative Marketing Agency',
                'abn' => '98765432109',
                'role' => 'customer',
                'password' => 'CustomerPass2026!',
                'email_verified_at' => now(),
            ]
        );

        UserAddress::firstOrCreate(
            ['user_id' => $customer->id, 'type' => 'shipping'],
            [
                'name' => 'Sarah Miller',
                'company' => 'Sydney Creative Marketing Agency',
                'address_line_1' => 'Suite 402, 100 George Street',
                'address_line_2' => 'The Rocks',
                'suburb' => 'Sydney',
                'state' => 'NSW',
                'postcode' => '2000',
                'country' => 'AU',
                'phone' => '0412 345 678',
                'is_default' => true,
            ]
        );
    }
}
