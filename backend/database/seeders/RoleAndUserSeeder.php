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
        // 1. Super Admin Account
        $admin = User::firstOrCreate(
            ['email' => 'admin@printecommerce.com.au'],
            [
                'name' => 'Print Operations Admin',
                'phone' => '1300 000 789',
                'company_name' => 'Print Ecommerce  Pty Ltd',
                'abn' => '12345678901',
                'role' => 'admin',
                'password' => Hash::make('SecretAdmin2026!'),
                'email_verified_at' => now(),
            ]
        );

        // 2. Prepress Operator
        User::firstOrCreate(
            ['email' => 'prepress@printecommerce.com.au'],
            [
                'name' => 'Jack Henderson',
                'phone' => '0400 111 222',
                'company_name' => 'Print Ecommerce ',
                'role' => 'prepress_operator',
                'password' => Hash::make('PrepressPass2026!'),
                'email_verified_at' => now(),
            ]
        );

        // 3. Sample Customer with n Address
        $customer = User::firstOrCreate(
            ['email' => 'sarah.miller@sydneymarketing.com.au'],
            [
                'name' => 'Sarah Miller',
                'phone' => '0412 345 678',
                'company_name' => 'Sydney Creative Marketing Agency',
                'abn' => '98765432109',
                'role' => 'customer',
                'password' => Hash::make('CustomerPass2026!'),
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
