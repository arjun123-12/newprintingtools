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

        $statusDetails = match ($this->order->status->value ?? (string) $this->order->status) {
            'printing', 'production_started', 'in_production' => "Your order {$orderNumber} is currently running on our commercial printing presses.",
            'cutting_and_finishing', 'cutting_in_progress' => "Your order {$orderNumber} is currently undergoing precision cutting, trimming, folding and finishing.",
            'quality_check_and_packaging', 'production_completed' => "Your order {$orderNumber} has completed production and is currently in final quality inspection and protective packaging.",
            'ready_for_pickup' => "Great news! Your order {$orderNumber} has been packed and is ready for collection at our store. Please present your order number upon collection.",
            'handed_over_to_courier', 'dispatched' => "Your order {$orderNumber} has been dispatched and handed over to the courier for delivery.",
            'delivered' => "Your order {$orderNumber} has been delivered to your provided address. Thank you for your business!",
            'collected' => "Your order {$orderNumber} has been collected from our store. Thank you for choosing Erry Imprints!",
            default => "The status of your order {$orderNumber} has been updated to: {$this->statusLabel}.",
        };

        $body = "Dear {$customerName},\n\n"
            . "Order Update for {$orderNumber}:\n\n"
            . "Status: {$this->statusLabel}\n\n"
            . "{$statusDetails}\n"
            . $shippingSection
            . $trackingLinkSection . "\n"
            . "Thank you for choosing Erry Imprints.\n\n"
            . "Warm regards,\n"
            . "Erry Imprints Team\n"
            . "Info@erryimprints.com.au";

        return $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject("Order {$orderNumber} Update: {$this->statusLabel} | Erry Imprints")
            ->raw($body);
    }
}
