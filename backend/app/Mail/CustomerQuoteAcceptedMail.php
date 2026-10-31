<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Models\CustomerQuote;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CustomerQuoteAcceptedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public CustomerQuote $quote, public ?CustomerEnquiry $enquiry, public Order $order, public string $uploadUrl) {}

    public function build(): self
    {
        $name = htmlspecialchars((string) ($this->quote->recipient_name ?: $this->enquiry?->name ?: 'there'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $orderNumber = htmlspecialchars($this->order->order_number, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $url = htmlspecialchars($this->uploadUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));
        $html = "<!doctype html><html><body style='font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px'><div style='max-width:600px;margin:auto;background:#fff;padding:28px;border-radius:14px'><h1>Quote accepted</h1><p>Hello {$name}, your quote has been accepted and order <strong>{$orderNumber}</strong> is ready for your artwork.</p><p>Use the secure link below to upload your print-ready files. Our team will review them and send you a proof for approval.</p><p style='text-align:center;margin:28px'><a href='{$url}' style='background:#0284c7;color:white;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>Upload artwork</a></p><p>Payment and production follow after proof approval.</p></div></body></html>";
        return $this->from($fromEmail, $fromName)
            ->subject("Order {$orderNumber} created — upload your artwork")
            ->html($html);
    }
}
