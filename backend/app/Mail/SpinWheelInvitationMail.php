<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SpinWheelInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $customerName,
        public string $spinUrl,
        public ?string $orderNumber = null,
        public ?string $customSubject = null,
        public ?string $customHeadline = null,
        public ?string $customMessage = null,
        public ?string $unsubscribeUrl = null
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', 'Info@erryimprints.com.au');
        $fromName = config('mail.from.name', 'Erry Imprints');
        $subject = $this->customSubject ?: '🎁 Spin to Win Your Exclusive Print Reward! | Erry Imprints';

        return $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject($subject)
            ->view('emails.spin-wheel-invitation', [
                'customerName' => $this->customerName,
                'spinUrl' => $this->spinUrl,
                'orderNumber' => $this->orderNumber,
                'headline' => $this->customHeadline ?: "You've Unlocked a Free Spin!",
                'messageText' => $this->customMessage ?: "Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credits, and free delivery upgrades on your next order.",
                'unsubscribeUrl' => $this->unsubscribeUrl,
            ]);
    }
}

