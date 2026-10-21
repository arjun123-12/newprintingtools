<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Services\Order\ManualOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class CustomerEnquiryStaffMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CustomerEnquiry $enquiry
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));

        $subject = "🔔 New Quote & Production Enquiry: [{$this->enquiry->reference}] - {$this->enquiry->name}";
        if ($this->enquiry->product_name) {
            $subject .= " | {$this->enquiry->product_name}";
        }

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
                . '<td style="padding: 7px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9; width: 40%; font-weight: 500;">' . $escape($label) . '</td>'
                . '<td style="padding: 7px 12px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">' . $escape($val) . '</td>'
                . '</tr>';
        }

        // Attachment info & URL
        $attachmentUrl = null;
        if ($this->enquiry->attachment_path) {
            $attachmentUrl = ManualOrderService::formatLivePublicStorageUrl($this->enquiry->attachment_path);
        }
        $attachmentSizeLabel = $this->enquiry->attachment_size_bytes
            ? number_format($this->enquiry->attachment_size_bytes / (1024 * 1024), 2) . ' MB'
            : null;

        $frontendUrl = ManualOrderService::getLiveFrontendUrl();
        $adminPortalUrl = rtrim($frontendUrl, '/') . '/admin/enquiries/' . $this->enquiry->id;
        $formattedDate = $this->enquiry->created_at?->format('d M Y, h:i A') ?? now()->format('d M Y, h:i A');

        $ref = $escape($this->enquiry->reference);
        $custName = $escape($this->enquiry->name);
        $custEmail = $escape($this->enquiry->email);
        $custPhone = $escape($this->enquiry->phone ?: 'Not provided');
        $custLocation = $escape($this->enquiry->delivery_location ?: 'Not provided');
        $product = $escape($this->enquiry->product_name ?: 'Custom Print Job');
        $quantity = $this->enquiry->quantity ? number_format($this->enquiry->quantity) : 'Not specified';
        $requirements = !empty($this->enquiry->additional_requirements)
            ? nl2br($escape($this->enquiry->additional_requirements))
            : '<span style="color: #94a3b8; font-style: italic;">No special instructions provided.</span>';

        $attachmentSection = '';
        if ($attachmentUrl) {
            $fileName = $escape($this->enquiry->attachment_original_name ?: 'Artwork File');
            $sizeBadge = $attachmentSizeLabel ? " ({$attachmentSizeLabel})" : '';
            $attachmentSection = <<<HTML
              <div style="margin-top: 20px; padding: 14px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">📎 Attached Artwork / File</div>
                <div style="font-size: 13px; color: #15803d; font-weight: 600;">{$fileName}{$sizeBadge}</div>
                <div style="margin-top: 8px;">
                  <a href="{$attachmentUrl}" target="_blank" style="display: inline-block; padding: 6px 14px; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; border-radius: 6px;">Download Artwork File</a>
                </div>
              </div>
HTML;
        }

        $specsTable = $specsRows ? <<<HTML
          <div style="margin-top: 18px;">
            <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📋 Job Specifications</div>
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
  <div style="max-width: 640px; margin: 24px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="padding: 24px 28px; background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); color: #ffffff;">
      <div style="display: inline-block; padding: 4px 10px; background-color: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #bae6fd; margin-bottom: 8px;">
        New Quote Enquiry
      </div>
      <h1 style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #ffffff;">{$product}</h1>
      <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Reference: <strong style="color: #ffffff; font-family: monospace;">{$ref}</strong> &bull; {$formattedDate}</p>
    </div>

    <!-- Content -->
    <div style="padding: 28px;">
      
      <!-- Customer Information Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">👤 Customer Details</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 35%; font-weight: 500;">Name</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">{$custName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Email</td>
            <td style="padding: 4px 0; font-weight: 600;"><a href="mailto:{$custEmail}" style="color: #0284c7; text-decoration: none;">{$custEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Phone</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">{$custPhone}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Delivery Suburb / Postcode</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">{$custLocation}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Requested Quantity</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 800; font-size: 14px;">{$quantity} units</td>
          </tr>
        </table>
      </div>

      <!-- Specifications -->
      {$specsTable}

      <!-- Additional Notes / Requirements -->
      <div style="margin-top: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📝 Notes / Job Deadlines</div>
        <div style="padding: 14px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; color: #334155; line-height: 1.6;">
          {$requirements}
        </div>
      </div>

      <!-- Attachment -->
      {$attachmentSection}

      <!-- Action Buttons -->
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <a href="mailto:{$custEmail}?subject=Re:%20Quote%20Enquiry%20{$ref}%20-%20Erry%20Imprints" style="display: inline-block; padding: 10px 22px; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 8px; margin-right: 8px;">
          Reply to Customer ({$custEmail})
        </a>
        <a href="{$adminPortalUrl}" target="_blank" style="display: inline-block; padding: 10px 22px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 8px;">
          View in Admin Portal
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding: 16px 28px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      This notification was automatically sent by Erry Imprints Prepress &amp; Production System.
    </div>

  </div>
</body>
</html>
HTML;

        $mail = $this->from($fromEmail, $fromName)
            ->replyTo($this->enquiry->email, $this->enquiry->name)
            ->subject($subject)
            ->html($html);

        // Attach uploaded file if accessible on local storage and size <= 20MB
        if ($this->enquiry->attachment_path && Storage::disk('public')->exists($this->enquiry->attachment_path)) {
            $fullPath = Storage::disk('public')->path($this->enquiry->attachment_path);
            if (file_exists($fullPath) && filesize($fullPath) <= 20 * 1024 * 1024) {
                $mail->attach($fullPath, [
                    'as' => $this->enquiry->attachment_original_name ?: basename($fullPath),
                    'mime' => $this->enquiry->attachment_mime_type ?: 'application/octet-stream',
                ]);
            }
        }

        return $mail;
    }
}
