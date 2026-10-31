<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Models\CustomerQuote;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CustomerQuoteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public CustomerQuote $quote, public ?CustomerEnquiry $enquiry, public string $quoteUrl) {}

    public function build(): self
    {
        $escape = static fn ($value): string => htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $currencySymbol = '$';
        $rows = '';
        foreach ($this->quote->items ?? [] as $item) {
            $name = $escape($item['product_name'] ?? 'Print product');
            $qty = (int) ($item['quantity'] ?? 0);
            $line = number_format((float) ($item['line_total_inc_gst'] ?? 0), 2);
            $spec = $escape($item['options']['specifications'] ?? '');
            $rows .= "<tr><td style='padding:10px;border-bottom:1px solid #e2e8f0'><strong>{$name}</strong><br><small>{$spec}</small></td><td style='padding:10px;border-bottom:1px solid #e2e8f0'>{$qty}</td><td style='padding:10px;border-bottom:1px solid #e2e8f0;text-align:right'>{$currencySymbol}{$line}</td></tr>";
        }
        $number = $escape($this->quote->quote_number);
        $customer = $escape($this->quote->recipient_name ?: $this->enquiry?->name ?: 'there');
        $total = number_format((float) $this->quote->total_inc_gst, 2);
        $url = htmlspecialchars($this->quoteUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $expiry = $this->quote->expires_at?->format('d M Y') ?? 'as stated in the quote';
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));
        $html = "<!doctype html><html><body style='font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px'><div style='max-width:620px;margin:auto;background:white;padding:28px;border-radius:14px'><h1 style='color:#0f172a'>Your Erry Imprints quote</h1><p>Hello {$customer}, quote <strong>{$number}</strong> is ready for review.</p><table style='width:100%;border-collapse:collapse'><thead><tr><th align='left'>Item</th><th align='left'>Qty</th><th align='right'>Inc. GST</th></tr></thead><tbody>{$rows}</tbody></table><p style='text-align:right;font-size:18px'><strong>Total: AUD {$currencySymbol}{$total}</strong></p><p>Valid until {$expiry}.</p><p style='text-align:center;margin:28px'><a href='{$url}' style='background:#0284c7;color:white;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>Review and accept quote</a></p><p>Accepting creates your order and opens the artwork upload step. Production does not start until proof and payment steps are completed.</p></div></body></html>";
        return $this->from($fromEmail, $fromName)
            ->subject("Your quote {$number} from Erry Imprints")
            ->html($html);
    }
}
