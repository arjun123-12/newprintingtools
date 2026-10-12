<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminInvoiceController extends Controller
{
    /**
     * Store metadata for Australian Tax Invoices (ATO Compliant)
     */
    protected array $storeInfo = [
        'name' => 'Erry Imprints Pty Ltd',
        'trading_name' => 'Erry Imprints',
        'abn' => '12 345 678 901',
        'email' => 'orders@erryimprints.com.au',
        'phone' => '1300 000 000',
        'address_line_1' => 'Level 1, 100 George Street',
        'city' => 'Sydney',
        'state' => 'NSW',
        'postcode' => '2000',
        'country' => 'Australia',
        'gst_rate' => 0.10, // 10% Australian GST
    ];

    /**
     * List all tax invoices and payment transactions with detailed Australian GST breakdown.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $paymentStatus = trim((string) $request->query('payment_status', 'all'));
        $gateway = trim((string) $request->query('gateway', 'all'));
        $sortBy = trim((string) $request->query('sort_by', 'newest'));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        // Ensure all existing orders have linked invoices in the database
        $this->ensureInvoicesForOrders();

        $query = Order::query()
            ->with([
                'user:id,name,email,phone,company_name,abn,role',
                'payments' => function ($q) {
                    $q->latest();
                },
                'items.product:id,name,sku',
                'invoice',
            ]);

        // Filter by Payment Status
        if ($paymentStatus !== 'all' && !empty($paymentStatus)) {
            $query->where('payment_status', $paymentStatus);
        }

        // Filter by Gateway
        if ($gateway !== 'all' && !empty($gateway)) {
            $query->whereHas('payments', function ($q) use ($gateway) {
                $q->where('gateway', $gateway);
            });
        }

        // Filter by Date Range
        if (!empty($dateFrom)) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if (!empty($dateTo)) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        // Search Filter
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhereHas('invoice', function ($iq) use ($search) {
                      $iq->where('invoice_number', 'like', "%{$search}%");
                  })
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%")
                         ->orWhere('company_name', 'like', "%{$search}%")
                         ->orWhere('abn', 'like', "%{$search}%");
                  })
                  ->orWhereHas('payments', function ($pq) use ($search) {
                      $pq->where('transaction_id', 'like', "%{$search}%")
                         ->orWhere('gateway', 'like', "%{$search}%");
                  })
                  ->orWhere('shipping_address', 'like', "%{$search}%")
                  ->orWhere('billing_address', 'like', "%{$search}%");
            });
        }

        // Sorting
        switch ($sortBy) {
            case 'oldest':
                $query->oldest('created_at');
                break;
            case 'amount_high':
                $query->orderByDesc('total_inc_gst');
                break;
            case 'amount_low':
                $query->orderBy('total_inc_gst');
                break;
            case 'newest':
            default:
                $query->latest('created_at');
                break;
        }

        $orders = $query->get();

        // Calculate KPI Stats across all orders
        $allOrders = Order::with('payments')->get();
        $paidOrders = $allOrders->filter(fn ($o) => (string) ($o->payment_status->value ?? $o->payment_status) === 'paid');

        $totalRevenueIncGst = $paidOrders->sum(fn ($o) => (float) $o->total_inc_gst);
        $totalSubtotalExGst = $paidOrders->sum(fn ($o) => (float) $o->subtotal_ex_gst);
        $totalGstCollected = $paidOrders->sum(fn ($o) => (float) $o->gst_amount);

        // Gateway breakdown
        $gateways = [];
        foreach ($paidOrders as $o) {
            foreach ($o->payments as $p) {
                if ($p->status === 'succeeded' || $p->status === 'paid') {
                    $gw = strtolower($p->gateway ?: 'other');
                    if (!isset($gateways[$gw])) {
                        $gateways[$gw] = ['count' => 0, 'amount' => 0.0];
                    }
                    $gateways[$gw]['count']++;
                    $gateways[$gw]['amount'] += (float) $p->amount;
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => $orders,
            'stats' => [
                'total_revenue_inc_gst' => round($totalRevenueIncGst, 2),
                'total_subtotal_ex_gst' => round($totalSubtotalExGst, 2),
                'total_gst_collected' => round($totalGstCollected, 2),
                'successful_payments_count' => $paidOrders->count(),
                'total_orders_count' => $allOrders->count(),
                'gateways' => $gateways,
            ],
            'store_info' => $this->storeInfo,
        ]);
    }

    /**
     * Get single Tax Invoice details with complete ATO breakdown.
     */
    public function show(string $id): JsonResponse
    {
        $order = Order::with([
            'user',
            'payments',
            'items.product',
            'invoice',
        ])->where('id', $id)->orWhere('order_number', $id)->first();

        if (!$order) {
            $invoice = Invoice::where('id', $id)->orWhere('invoice_number', $id)->first();
            if ($invoice) {
                $order = Order::with(['user', 'payments', 'items.product', 'invoice'])->find($invoice->order_id);
            }
        }

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice or Order not found',
            ], 404);
        }

        // Ensure invoice relation exists
        if (!$order->invoice) {
            $this->ensureInvoicesForOrders();
            $order->load('invoice');
        }

        return response()->json([
            'success' => true,
            'data' => $order,
            'store_info' => $this->storeInfo,
        ]);
    }

    /**
     * Create a new custom invoice (QuickBooks style).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable',
            'customer_name' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'billing_address' => 'nullable|array',
            'shipping_address' => 'nullable|array',
            'invoice_number' => 'nullable|string|max:50',
            'terms' => 'nullable|string|max:50',
            'issued_at' => 'nullable|date',
            'due_at' => 'nullable|date',
            'po_reference' => 'nullable|string|max:100',
            'tax_mode' => 'nullable|string|in:exclusive,inclusive,out_of_scope',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable',
            'items.*.product_name' => 'required|string|max:255',
            'items.*.product_sku' => 'nullable|string|max:100',
            'items.*.description' => 'nullable|string',
            'items.*.service_date' => 'nullable|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.rate' => 'required|numeric|min:0',
            'items.*.amount' => 'nullable|numeric|min:0',
            'items.*.tax_rate' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
            'customer_notes' => 'nullable|string',
            'memo_on_statement' => 'nullable|string',
            'admin_notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:50',
            'status' => 'nullable|string|in:draft,issued,paid',
        ]);

        return DB::transaction(function () use ($validated) {
            // 1. Resolve Customer
            $user = null;
            if (!empty($validated['customer_id'])) {
                $user = User::find($validated['customer_id']);
            }
            if (!$user && !empty($validated['customer_email'])) {
                $user = User::where('email', strtolower(trim($validated['customer_email'])))->first();
                if (!$user) {
                    $user = User::create([
                        'name' => $validated['customer_name'] ?: 'Customer',
                        'email' => strtolower(trim($validated['customer_email'])),
                        'role' => User::ROLE_CUSTOMER,
                        'password' => \Illuminate\Support\Facades\Hash::make(Str::random(16)),
                    ]);
                }
            }
            if (!$user) {
                $user = User::where('role', User::ROLE_CUSTOMER)->first() ?? User::first();
            }

            // 2. Calculations
            $taxMode = $validated['tax_mode'] ?? 'exclusive';
            $discountType = $validated['discount_type'] ?? 'percentage';
            $discountValue = (float) ($validated['discount_value'] ?? 0);
            $shippingFee = (float) ($validated['shipping_fee'] ?? 0);

            $rawSubtotal = 0.0;
            $totalGst = 0.0;

            $processedItems = [];
            foreach ($validated['items'] as $item) {
                $qty = (float) $item['quantity'];
                $rate = (float) $item['rate'];
                $taxPercent = isset($item['tax_rate']) ? (float) $item['tax_rate'] : 10.0;

                if ($taxMode === 'exclusive') {
                    $lineExGst = $qty * $rate;
                    $lineGst = $taxPercent > 0 ? $lineExGst * ($taxPercent / 100.0) : 0.0;
                    $lineIncGst = $lineExGst + $lineGst;
                    $unitExGst = $rate;
                    $unitIncGst = $rate * (1 + $taxPercent / 100.0);
                } elseif ($taxMode === 'inclusive') {
                    $lineIncGst = $qty * $rate;
                    $lineGst = $taxPercent > 0 ? $lineIncGst - ($lineIncGst / (1 + $taxPercent / 100.0)) : 0.0;
                    $lineExGst = $lineIncGst - $lineGst;
                    $unitIncGst = $rate;
                    $unitExGst = $taxPercent > 0 ? $rate / (1 + $taxPercent / 100.0) : $rate;
                } else {
                    $lineExGst = $qty * $rate;
                    $lineGst = 0.0;
                    $lineIncGst = $lineExGst;
                    $unitExGst = $rate;
                    $unitIncGst = $rate;
                }

                $rawSubtotal += $lineExGst;
                $totalGst += $lineGst;

                $processedItems[] = [
                    'product_id' => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'product_sku' => $item['product_sku'] ?? ('SVC-' . strtoupper(Str::random(4))),
                    'quantity' => (int) max(1, round($qty)),
                    'unit_price_ex_gst' => round($unitExGst, 4),
                    'unit_price_inc_gst' => round($unitIncGst, 4),
                    'total_price_inc_gst' => round($lineIncGst, 2),
                    'options_snapshot' => [
                        'description' => $item['description'] ?? '',
                        'service_date' => $item['service_date'] ?? null,
                        'rate' => $rate,
                        'tax_rate' => $taxPercent,
                    ],
                ];
            }

            // Discount calculation
            $discountAmount = 0.0;
            if ($discountValue > 0) {
                if ($discountType === 'percentage') {
                    $discountAmount = $rawSubtotal * ($discountValue / 100.0);
                } else {
                    $discountAmount = min($discountValue, $rawSubtotal);
                }
            }

            $discountedSubtotal = max(0.0, $rawSubtotal - $discountAmount);
            if ($rawSubtotal > 0 && $discountAmount > 0) {
                $totalGst = $totalGst * ($discountedSubtotal / $rawSubtotal);
            }

            $totalIncGst = $discountedSubtotal + $totalGst + $shippingFee;

            $status = $validated['status'] ?? 'issued';
            $isPaid = $status === 'paid';

            // 3. Create Order
            $order = Order::create([
                'order_number' => 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(4)),
                'user_id' => $user->id,
                'status' => $isPaid ? OrderStatus::PROCESSING : OrderStatus::PENDING_PAYMENT,
                'payment_status' => $isPaid ? PaymentStatus::PAID : PaymentStatus::UNPAID,
                'subtotal_ex_gst' => round($discountedSubtotal, 2),
                'gst_amount' => round($totalGst, 2),
                'shipping_fee_inc_gst' => round($shippingFee, 2),
                'discount_amount' => round($discountAmount, 2),
                'total_inc_gst' => round($totalIncGst, 2),
                'currency' => 'AUD',
                'billing_address' => $validated['billing_address'] ?? [
                    'name' => $validated['customer_name'] ?? $user->name,
                    'address_line_1' => '',
                    'suburb' => 'Sydney',
                    'state' => 'NSW',
                    'postcode' => '2000',
                    'country' => 'AU',
                ],
                'shipping_address' => $validated['shipping_address'] ?? $validated['billing_address'] ?? [],
                'customer_notes' => $validated['customer_notes'] ?? null,
                'admin_notes' => json_encode([
                    'po_reference' => $validated['po_reference'] ?? null,
                    'terms' => $validated['terms'] ?? 'Due on receipt',
                    'tax_mode' => $taxMode,
                    'memo_on_statement' => $validated['memo_on_statement'] ?? null,
                    'primary_payment_method' => $validated['payment_method'] ?? null,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'custom_notes' => $validated['admin_notes'] ?? null,
                ]),
            ]);

            // 4. Create Order Items
            $defaultProductId = Product::first()?->id;
            foreach ($processedItems as $pItem) {
                $prodId = $pItem['product_id'];
                if (!$prodId || !Product::where('id', $prodId)->exists()) {
                    $prodId = $defaultProductId;
                }

                $order->items()->create([
                    'product_id' => $prodId,
                    'product_name' => $pItem['product_name'],
                    'product_sku' => $pItem['product_sku'],
                    'quantity' => $pItem['quantity'],
                    'unit_price_ex_gst' => $pItem['unit_price_ex_gst'],
                    'unit_price_inc_gst' => $pItem['unit_price_inc_gst'],
                    'total_price_inc_gst' => $pItem['total_price_inc_gst'],
                    'options_snapshot' => $pItem['options_snapshot'],
                ]);
            }

            // 5. Create Invoice
            $invNum = trim((string) ($validated['invoice_number'] ?? ''));
            if (empty($invNum)) {
                $invNum = 'INV-' . date('Y') . '-' . rand(1000, 9999);
            }
            if (Invoice::where('invoice_number', $invNum)->exists()) {
                $invNum = $invNum . '-' . strtoupper(Str::random(3));
            }

            $issuedAt = !empty($validated['issued_at']) ? $validated['issued_at'] : now()->toDateString();
            $dueAt = !empty($validated['due_at']) ? $validated['due_at'] : now()->addDays(14)->toDateString();

            Invoice::create([
                'order_id' => $order->id,
                'invoice_number' => $invNum,
                'status' => $status,
                'issued_at' => $issuedAt,
                'due_at' => $dueAt,
            ]);

            // 6. Record Payment if marked as paid
            if ($isPaid) {
                Payment::create([
                    'order_id' => $order->id,
                    'gateway' => $validated['payment_method'] ?: 'direct_deposit',
                    'transaction_id' => 'TXN-' . strtoupper(Str::random(10)),
                    'amount' => $totalIncGst,
                    'currency' => 'AUD',
                    'status' => 'succeeded',
                ]);
            }

            $order->load(['user', 'payments', 'items.product', 'invoice']);

            return response()->json([
                'success' => true,
                'message' => 'Invoice created successfully',
                'data' => $order,
                'store_info' => $this->storeInfo,
            ], 201);
        });
    }

    /**
     * Update an existing invoice.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $order = Order::with(['invoice', 'items'])->where('id', $id)->first();
        if (!$order) {
            $invoice = Invoice::where('id', $id)->orWhere('invoice_number', $id)->first();
            if ($invoice) {
                $order = Order::with(['invoice', 'items'])->find($invoice->order_id);
            }
        }

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'billing_address' => 'nullable|array',
            'shipping_address' => 'nullable|array',
            'invoice_number' => 'nullable|string|max:50',
            'terms' => 'nullable|string|max:50',
            'issued_at' => 'nullable|date',
            'due_at' => 'nullable|date',
            'po_reference' => 'nullable|string|max:100',
            'tax_mode' => 'nullable|string|in:exclusive,inclusive,out_of_scope',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable',
            'items.*.product_name' => 'required|string|max:255',
            'items.*.product_sku' => 'nullable|string|max:100',
            'items.*.description' => 'nullable|string',
            'items.*.service_date' => 'nullable|string',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.rate' => 'required|numeric|min:0',
            'items.*.amount' => 'nullable|numeric|min:0',
            'items.*.tax_rate' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
            'customer_notes' => 'nullable|string',
            'memo_on_statement' => 'nullable|string',
            'admin_notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:50',
            'status' => 'nullable|string|in:draft,issued,paid',
        ]);

        return DB::transaction(function () use ($order, $validated) {
            $taxMode = $validated['tax_mode'] ?? 'exclusive';
            $discountType = $validated['discount_type'] ?? 'percentage';
            $discountValue = (float) ($validated['discount_value'] ?? 0);
            $shippingFee = (float) ($validated['shipping_fee'] ?? 0);

            $rawSubtotal = 0.0;
            $totalGst = 0.0;

            $processedItems = [];
            foreach ($validated['items'] as $item) {
                $qty = (float) $item['quantity'];
                $rate = (float) $item['rate'];
                $taxPercent = isset($item['tax_rate']) ? (float) $item['tax_rate'] : 10.0;

                if ($taxMode === 'exclusive') {
                    $lineExGst = $qty * $rate;
                    $lineGst = $taxPercent > 0 ? $lineExGst * ($taxPercent / 100.0) : 0.0;
                    $lineIncGst = $lineExGst + $lineGst;
                    $unitExGst = $rate;
                    $unitIncGst = $rate * (1 + $taxPercent / 100.0);
                } elseif ($taxMode === 'inclusive') {
                    $lineIncGst = $qty * $rate;
                    $lineGst = $taxPercent > 0 ? $lineIncGst - ($lineIncGst / (1 + $taxPercent / 100.0)) : 0.0;
                    $lineExGst = $lineIncGst - $lineGst;
                    $unitIncGst = $rate;
                    $unitExGst = $taxPercent > 0 ? $rate / (1 + $taxPercent / 100.0) : $rate;
                } else {
                    $lineExGst = $qty * $rate;
                    $lineGst = 0.0;
                    $lineIncGst = $lineExGst;
                    $unitExGst = $rate;
                    $unitIncGst = $rate;
                }

                $rawSubtotal += $lineExGst;
                $totalGst += $lineGst;

                $processedItems[] = [
                    'product_id' => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'product_sku' => $item['product_sku'] ?? ('SVC-' . strtoupper(Str::random(4))),
                    'quantity' => (int) max(1, round($qty)),
                    'unit_price_ex_gst' => round($unitExGst, 4),
                    'unit_price_inc_gst' => round($unitIncGst, 4),
                    'total_price_inc_gst' => round($lineIncGst, 2),
                    'options_snapshot' => [
                        'description' => $item['description'] ?? '',
                        'service_date' => $item['service_date'] ?? null,
                        'rate' => $rate,
                        'tax_rate' => $taxPercent,
                    ],
                ];
            }

            $discountAmount = 0.0;
            if ($discountValue > 0) {
                if ($discountType === 'percentage') {
                    $discountAmount = $rawSubtotal * ($discountValue / 100.0);
                } else {
                    $discountAmount = min($discountValue, $rawSubtotal);
                }
            }

            $discountedSubtotal = max(0.0, $rawSubtotal - $discountAmount);
            if ($rawSubtotal > 0 && $discountAmount > 0) {
                $totalGst = $totalGst * ($discountedSubtotal / $rawSubtotal);
            }

            $totalIncGst = $discountedSubtotal + $totalGst + $shippingFee;

            $status = $validated['status'] ?? ($order->invoice?->status ?? 'issued');
            $isPaid = $status === 'paid';

            $order->update([
                'status' => $isPaid ? OrderStatus::PROCESSING : OrderStatus::PENDING_PAYMENT,
                'payment_status' => $isPaid ? PaymentStatus::PAID : PaymentStatus::UNPAID,
                'subtotal_ex_gst' => round($discountedSubtotal, 2),
                'gst_amount' => round($totalGst, 2),
                'shipping_fee_inc_gst' => round($shippingFee, 2),
                'discount_amount' => round($discountAmount, 2),
                'total_inc_gst' => round($totalIncGst, 2),
                'billing_address' => $validated['billing_address'] ?? $order->billing_address,
                'shipping_address' => $validated['shipping_address'] ?? $order->shipping_address,
                'customer_notes' => $validated['customer_notes'] ?? $order->customer_notes,
                'admin_notes' => json_encode([
                    'po_reference' => $validated['po_reference'] ?? null,
                    'terms' => $validated['terms'] ?? 'Due on receipt',
                    'tax_mode' => $taxMode,
                    'memo_on_statement' => $validated['memo_on_statement'] ?? null,
                    'primary_payment_method' => $validated['payment_method'] ?? null,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'custom_notes' => $validated['admin_notes'] ?? null,
                ]),
            ]);

            // Sync items
            $order->items()->delete();
            $defaultProductId = Product::first()?->id;
            foreach ($processedItems as $pItem) {
                $prodId = $pItem['product_id'];
                if (!$prodId || !Product::where('id', $prodId)->exists()) {
                    $prodId = $defaultProductId;
                }

                $order->items()->create([
                    'product_id' => $prodId,
                    'product_name' => $pItem['product_name'],
                    'product_sku' => $pItem['product_sku'],
                    'quantity' => $pItem['quantity'],
                    'unit_price_ex_gst' => $pItem['unit_price_ex_gst'],
                    'unit_price_inc_gst' => $pItem['unit_price_inc_gst'],
                    'total_price_inc_gst' => $pItem['total_price_inc_gst'],
                    'options_snapshot' => $pItem['options_snapshot'],
                ]);
            }

            // Update Invoice
            if ($order->invoice) {
                $invData = ['status' => $status];
                if (!empty($validated['invoice_number'])) {
                    $invData['invoice_number'] = $validated['invoice_number'];
                }
                if (!empty($validated['issued_at'])) {
                    $invData['issued_at'] = $validated['issued_at'];
                }
                if (!empty($validated['due_at'])) {
                    $invData['due_at'] = $validated['due_at'];
                }
                $order->invoice->update($invData);
            }

            // Payment check
            if ($isPaid && !$order->payments()->where('status', 'succeeded')->exists()) {
                Payment::create([
                    'order_id' => $order->id,
                    'gateway' => $validated['payment_method'] ?: 'direct_deposit',
                    'transaction_id' => 'TXN-' . strtoupper(Str::random(10)),
                    'amount' => $totalIncGst,
                    'currency' => 'AUD',
                    'status' => 'succeeded',
                ]);
            }

            $order->load(['user', 'payments', 'items.product', 'invoice']);

            return response()->json([
                'success' => true,
                'message' => 'Invoice updated successfully',
                'data' => $order,
                'store_info' => $this->storeInfo,
            ]);
        });
    }

    /**
     * Delete an invoice and associated order record.
     */
    public function destroy(string $id): JsonResponse
    {
        $order = Order::with('invoice')->where('id', $id)->first();
        if (!$order) {
            $invoice = Invoice::where('id', $id)->first();
            if ($invoice) {
                $order = Order::find($invoice->order_id);
            }
        }

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        $order->items()->delete();
        $order->payments()->delete();
        $order->invoice()?->delete();
        $order->delete();

        return response()->json([
            'success' => true,
            'message' => 'Invoice deleted successfully',
        ]);
    }
}
