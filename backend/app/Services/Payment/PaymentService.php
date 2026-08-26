<?php

namespace App\Services\Payment;

class PaymentService
{
    public function processPayment(array $paymentData): array
    {
        return [
            'status' => 'success',
            'transaction_id' => 'tx_' . uniqid(),
        ];
    }
}
