<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Services\Order\ManualOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CustomerEnquiryCustomerMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CustomerEnquiry $enquiry
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));

        $subject = "Quote Request Received: [{$this->enquiry->reference}] | Erry Imprints";

        $escape = static fn ($val): string => htmlspecialchars((string) ($val ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        // Format specifications
        $specs = (array) ($this->enquiry->specifications ?? []);
        $formattedSpecs = [];
        if (!empty($specs['size'])) $formattedSpecs['Size / Format'] = $specs['size'];
        if (!empty($specs['gsm'])) $formattedSpecs['Paper Stock / GSM'] = $specs['gsm'];
        if (!empty($specs['paper_stock']) && empty($specs['gsm'])) $formattedSpecs['Paper Stock / GSM'] = $specs['paper_stock'];
        if (!empty($specs['printing_sides'])) $formattedSpecs['Printing Sides'] = $specs['printing_sides'];
        if (!empty($specs['sides']) && empty($specs['printing_sides'])) $formattedSpecs['Printing Sides'] = $specs['sides'];
        if (!empty($specs['finishing'])) $formattedSpecs['Finishing'] = $specs['finishing'];
        if (!empty($specs['folding']) && $specs['folding'] !== 'No Folding') $formattedSpecs['Folding'] = $specs['folding'];

        foreach ($specs as $key => $val) {
            if (!is_scalar($val)) continue;
            $label = ucwords(str_replace(['_', '-'], ' ', (string) $key));
            if (!isset($formattedSpecs[$label]) && !in_array($key, ['size', 'gsm', 'paper_stock', 'printing_sides', 'sides', 'finishing', 'folding'])) {
                $formattedSpecs[$label] = (string) $val;
            }
        }

        $specsRows = '';
        foreach ($formattedSpecs as $label => $val) {
            $specsRows .= '<tr>'
                . '<td style="padding: 7px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9; width: 45%; font-weight: 500;">' . $escape($label) . '</td>'
                . '<td style="padding: 7px 12px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">' . $escape($val) . '</td>'
                . '</tr>';
        }

        $frontendUrl = ManualOrderService::getLiveFrontendUrl();
        $ref = $escape($this->enquiry->reference);
        $custName = $escape($this->enquiry->name);
        $product = $escape($this->enquiry->product_name ?: 'Custom Print Job');
        $quantity = $this->enquiry->quantity ? number_format($this->enquiry->quantity) : 'As discussed';

        $specsTable = $specsRows ? <<<HTML
          <div style="margin-top: 18px;">
            <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📋 Your Submitted Specifications</div>
            <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <tbody>{$specsRows}</tbody>
            </table>
          </div>
HTML : '';

        $html = <<<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><title>{$subject}</title></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <div style="max-width: 600px; margin: 24px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="padding: 24px 28px; background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); color: #ffffff;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7dd3fc; margin-bottom: 4px;">Erry Imprints</div>
      <h1 style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #ffffff;">We've Received Your Quote Request</h1>
      <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Reference Number: <strong style="color: #ffffff; font-family: monospace;">{$ref}</strong></p>
    </div>

    <!-- Content -->
    <div style="padding: 28px;">
      <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Hi <strong>{$custName}</strong>,</p>
      
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Thank you for contacting <strong>Erry Imprints</strong>. We have received your project details for <strong>{$product}</strong> ({$quantity} units).
      </p>

      <div style="padding: 14px 18px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 2px;">⚡ What happens next?</div>
        <div style="font-size: 13px; color: #15803d; line-height: 1.5;">
          Our prepress &amp; production specialists are reviewing your requirements. We will prepare an official quotation with accurate pricing and turnaround schedules and email it to you within <strong>1 business day</strong>.
        </div>
      </div>

      <!-- Project Summary -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📦 Project Overview</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 40%; font-weight: 500;">Product</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{$product}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Quantity</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{$quantity} units</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Enquiry Reference</td>
            <td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #0284c7;">{$ref}</td>
          </tr>
        </table>
      </div>

      {$specsTable}

      <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.6;">
        If you have any questions or additional files to add to this enquiry, simply reply directly to this email or reach us at <a href="mailto:info@erryimprints.com.au" style="color: #0284c7; text-decoration: none; font-weight: 600;">info@erryimprints.com.au</a>.
      </div>

      <p style="margin-top: 20px; margin-bottom: 0; font-size: 13px; color: #334155;">
        Warm regards,<br>
        <strong>Erry Imprints Team</strong><br>
        <span style="color: #64748b; font-size: 12px;">Quality Commercial Printing &amp; Custom Signage</span>
      </p>

    </div>

    <!-- Footer -->
    <div style="padding: 16px 28px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      &copy; " . date('Y') . " Erry Imprints. All rights reserved. &bull; <a href=\"{$frontendUrl}\" style=\"color: #64748b; text-decoration: underline;\">Visit Website</a>
    </div>

  </div>
</body>
</html>
HTML;

        return $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject($subject)
            ->html($html);
    }
}
