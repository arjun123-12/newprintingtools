<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminInvoiceController extends Controller
{
    /**
     * Store metadata for Australian Tax Invoices (ATO Compliant)
     */
    protected array $storeInfo = [
        'name' => 'Print Ecommerce Pty Ltd',
        'trading_name' => 'PrintOps Australia',
        'abn' => '12 345 678 901',
        'email' => 'accounts@printecommerce.com.au',
        'phone' => '1300 000 789',
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
     * Ensure each order has an invoice generated and stored in the database.
     */
    protected function ensureInvoicesForOrders(): void
    {
        $ordersWithoutInvoices = Order::whereDoesntHave('invoice')->get();

        foreach ($ordersWithoutInvoices as $order) {
            $cleanCode = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) $order->order_number));
            $shortCode = substr($cleanCode, -6) ?: rand(100000, 999999);
            $invoiceNumber = 'INV-' . $order->created_at->format('Y') . '-' . $shortCode;

            // Handle possible collisions
            if (Invoice::where('invoice_number', $invoiceNumber)->exists()) {
                $invoiceNumber = 'INV-' . $order->created_at->format('Y') . '-' . rand(100000, 999999);
            }

            $isPaid = (string) ($order->payment_status->value ?? $order->payment_status) === 'paid';

            Invoice::create([
                'order_id' => $order->id,
                'invoice_number' => $invoiceNumber,
                'status' => $isPaid ? 'paid' : 'issued',
                'issued_at' => $order->created_at->toDateString(),
                'due_at' => $order->created_at->addDays(14)->toDateString(),
            ]);
        }
    }
}
