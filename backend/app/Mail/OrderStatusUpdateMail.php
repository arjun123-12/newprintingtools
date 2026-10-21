<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdateMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public string $statusLabel,
        public ?string $secureTrackingUrl = null,
        public ?string $carrierTrackingUrl = null
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'Info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));
        $customerName = $this->order->shipping_address['name'] ?? $this->order->user?->name ?? 'Valued Customer';
        $orderNumber = $this->order->order_number;

        $shippingSection = "";
        if (!empty($this->order->shipping_carrier) || !empty($this->order->tracking_number)) {
            $shippingSection .= "\nShipping Details:\n";
            if (!empty($this->order->shipping_carrier)) {
                $shippingSection .= "• Carrier: {$this->order->shipping_carrier}\n";
            }
            if (!empty($this->order->tracking_number)) {
                $shippingSection .= "• Tracking Number: {$this->order->tracking_number}\n";
            }
            if (!empty($this->carrierTrackingUrl)) {
                $shippingSection .= "• Carrier Tracking Link: {$this->carrierTrackingUrl}\n";
            }
        }

        $trackingLinkSection = "";
        if (!empty($this->secureTrackingUrl)) {
            $trackingLinkSection = "\nYou can track your live order status and production history anytime at:\n{$this->secureTrackingUrl}\n";
        }

        $body = "Dear {$customerName},\n\n"
            . "We are pleased to inform you that the status of your order {$orderNumber} has been updated to:\n\n"
            . ">>> {$this->statusLabel} <<<\n"
            . $shippingSection
            . $trackingLinkSection . "\n"
            . "Thank you for printing with Erry Imprints.\n\n"
            . "Warm regards,\n"
            . "Erry Imprints Production & Dispatch Team\n"
            . "Info@erryimprints.com.au";

        return $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject("Order {$orderNumber} Update: {$this->statusLabel} | Erry Imprints")
            ->raw($body);
    }
}
