<?php

namespace App\Services\Invoice;

use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;

class InvoiceGeneratorService
{
    /**
     * Create (or mark) the order invoice as paid after a verified payment.
     * The order row lock and one-invoice-per-order lookup make retries safe.
     */
    public function issuePaidInvoice(Order $order): Invoice
    {
        return DB::transaction(function () use ($order): Invoice {
            $lockedOrder = Order::query()
                ->whereKey($order->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->payment_status !== PaymentStatus::PAID) {
                throw new LogicException('An invoice can only be issued after payment is confirmed.');
            }

            $invoice = $lockedOrder->invoice()->first();
            if (!$invoice) {
                do {
                    $invoiceNumber = 'INV-' . now()->format('Y') . '-' . Str::upper(Str::random(7));
                } while (Invoice::query()->where('invoice_number', $invoiceNumber)->exists());

                $invoice = $lockedOrder->invoice()->create([
                    'invoice_number' => $invoiceNumber,
                    'status' => 'paid',
                    'issued_at' => now()->toDateString(),
                    'due_at' => null,
                ]);
            } elseif ($invoice->status !== 'paid') {
                $invoice->update([
                    'status' => 'paid',
                    'issued_at' => $invoice->issued_at ?: now()->toDateString(),
                ]);
            }

            return $invoice->refresh();
        });
    }
}
