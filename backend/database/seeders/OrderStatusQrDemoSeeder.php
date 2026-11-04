<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class OrderStatusQrDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (!app()->environment('local')) {
            throw new \RuntimeException('QR demo orders can only be seeded into the local environment.');
        }

        $product = Product::withTrashed()->first();
        if (!$product) {
            throw new \RuntimeException('No product exists in the local database. Seed the product catalog before QR demo orders.');
        }

        $customer = User::updateOrCreate(
            ['email' => 'qr-demo-customer@example.test'],
            [
                'name' => 'QR Demo Customer',
                'phone' => '0400000000',
                'company_name' => 'Local QR Test Only',
                'role' => User::ROLE_CUSTOMER,
                'is_active' => true,
                'password' => Str::random(48),
            ]
        );

        $itemStatusByOrderStatus = [
            'approved' => 'approved',
            'printing' => 'printing',
            'in_production' => 'in_production',
            'production_started' => 'production_started',
            'cutting_and_finishing' => 'cutting_and_finishing',
            'cutting_in_progress' => 'cutting_in_progress',
            'quality_check_and_packaging' => 'quality_check_and_packaging',
            'production_completed' => 'production_completed',
            'ready_for_pickup' => 'ready_for_pickup',
            'ready_for_shipping' => 'ready_for_shipping',
            'dispatched' => 'dispatched',
            'handed_over_to_courier' => 'handed_over_to_courier',
            'delivered' => 'delivered',
            'collected' => 'collected',
        ];

        foreach (OrderStatus::cases() as $status) {
            for ($copy = 1; $copy <= 2; $copy++) {
                $value = $status->value;
                $orderNumber = 'QR-DEMO-' . Str::upper($value) . '-' . str_pad((string) $copy, 2, '0', STR_PAD_LEFT);
                $isPickup = in_array($value, ['ready_for_pickup', 'collected'], true);
                $isRefunded = $value === 'refunded';
                $isUnpaid = in_array($value, ['draft', 'pending_payment'], true);
                $shippingAddress = [
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'company' => $customer->company_name,
                    'address_line_1' => '1 Local Test Street',
                    'address_line_2' => null,
                    'city' => 'Sydney',
                    'state' => 'NSW',
                    'postcode' => '2000',
                    'country' => 'AU',
                ];

                $order = Order::updateOrCreate(
                    ['order_number' => $orderNumber],
                    [
                        'user_id' => $customer->id,
                        'status' => $status,
                        'payment_status' => $isRefunded ? 'refunded' : ($isUnpaid ? 'unpaid' : 'paid'),
                        'subtotal_ex_gst' => 100.00,
                        'gst_amount' => 10.00,
                        'shipping_fee_inc_gst' => $isPickup ? 0.00 : 12.50,
                        'discount_amount' => 0.00,
                        'total_inc_gst' => $isPickup ? 110.00 : 122.50,
                        'currency' => 'AUD',
                        'delivery_method' => $isPickup ? 'Store pickup' : 'Standard delivery',
                        'shipping_address' => $shippingAddress,
                        'billing_address' => $shippingAddress,
                        'shipping_carrier' => in_array($value, ['dispatched', 'handed_over_to_courier', 'delivered'], true) ? 'Demo Courier' : null,
                        'tracking_number' => in_array($value, ['dispatched', 'handed_over_to_courier', 'delivered'], true) ? 'QRTEST' . $copy . strtoupper(substr(md5($value), 0, 6)) : null,
                        'customer_notes' => 'Local QR status test order. No real customer or shipment.',
                        'admin_notes' => 'DEMO DATA — created locally for order QR scanner testing only.',
                        'production_days' => 3,
                        'turnaround_duration_value' => 3,
                        'turnaround_duration_unit' => 'days',
                        'turnaround_day_type' => 'business',
                    ]
                );

                $item = $order->items()->first();
                $itemData = [
                    'product_id' => $product->id,
                    'product_name' => 'QR Test Job — ' . $product->name,
                    'product_sku' => 'QR-' . strtoupper(substr(md5($orderNumber), 0, 10)),
                    'quantity' => 100,
                    'unit_price_ex_gst' => 1.0000,
                    'unit_price_inc_gst' => 1.1000,
                    'total_price_inc_gst' => 110.00,
                    'options_snapshot' => ['specifications' => 'Local QR scanner test only', 'size' => 'A4 test sheet'],
                    'artwork_id' => null,
                    'designer_canvas_state' => null,
                    'production_status' => $itemStatusByOrderStatus[$value] ?? 'queued',
                ];
                if ($item) {
                    $item->update($itemData);
                } else {
                    $order->items()->create($itemData);
                }
            }
        }

        $statusCounts = Order::query()
            ->where('order_number', 'like', 'QR-DEMO-%')
            ->selectRaw('status, COUNT(*) as order_count')
            ->groupBy('status')
            ->pluck('order_count', 'status');
        foreach (OrderStatus::cases() as $status) {
            if ((int) ($statusCounts[$status->value] ?? 0) !== 2) {
                throw new \RuntimeException("Expected exactly 2 QR demo orders for status {$status->value}.");
            }
        }

        $this->command?->info('Verified 2 local QR demo orders for each of ' . count(OrderStatus::cases()) . ' statuses (' . (count(OrderStatus::cases()) * 2) . ' orders total).');
        $this->command?->info('All demo orders use QR-DEMO- order numbers and example.test email addresses.');
    }
}
