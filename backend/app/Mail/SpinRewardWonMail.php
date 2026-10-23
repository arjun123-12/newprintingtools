<?php

namespace App\Mail;

use App\Models\CustomerRewardLedger;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SpinRewardWonMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CustomerRewardLedger $reward,
        public Order $order
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', 'Info@erryimprints.com.au');
        $fromName = config('mail.from.name', 'Erry Imprints');
        $customerName = $this->order->shipping_address['name']
            ?? $this->order->user?->name
            ?? 'Valued Customer';
        $amount = number_format((float) $this->reward->value, 2);
        $valueLabel = match ($this->reward->reward_type) {
            'print_credit' => 'AUD $' . $amount . ' print credit',
            'free_product' => 'Free product reward',
            'premium_upgrade' => 'Premium upgrade',
            'shipping_upgrade' => (float) $this->reward->value > 0
                ? 'AUD $' . $amount . ' shipping credit'
                : 'Shipping upgrade',
            default => 'AUD $' . $amount,
        };
        $expiresAt = $this->reward->expires_at?->format('d M Y') ?? 'See reward terms';
        $howToUse = trim($this->reward->how_to_use) ?: 'Enter this reward code at checkout on your next eligible order.';
        $terms = trim($this->reward->terms) ?: 'This reward is subject to the stated expiry and eligibility conditions.';

        $body = "Dear {$customerName},\n\n"
            . "Congratulations! You have won a Spin & Win reward after order {$this->order->order_number}.\n\n"
            . "Reward: {$this->reward->title}\n"
            . "Reward value: {$valueLabel}\n"
            . "Claim code: {$this->reward->reward_code}\n"
            . "Valid until: {$expiresAt}\n\n"
            . "How to claim it on your next order:\n{$howToUse}\n\n"
            . "Terms: {$terms}\n\n"
            . "Your reward is saved to the customer account linked to this email. Keep this code for your next eligible print order.\n\n"
            . "Warm regards,\nErry Imprints Team\nInfo@erryimprints.com.au";

        return $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject("Your Spin & Win reward: {$this->reward->title} | Erry Imprints")
            ->raw($body);
    }
}
