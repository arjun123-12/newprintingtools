<?php

namespace App\Services\Invoice;

class InvoiceGeneratorService
{
    public function generate(int $orderId): array
    {
        return [
            'invoice_number' => 'INV-' . date('Y') . '-' . rand(10000, 99999),
            'issued_at' => now()->toDateString(),
        ];
    }
}
