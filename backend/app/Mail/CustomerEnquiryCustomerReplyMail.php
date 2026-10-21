<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Models\CustomerEnquiryMessage;
use App\Services\Order\ManualOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class CustomerEnquiryCustomerReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CustomerEnquiry $enquiry,
        public CustomerEnquiryMessage $replyMessage
    ) {}

    public function build(): self
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', 'info@erryimprints.com.au'));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', 'Erry Imprints'));

        $subject = "💬 Customer Reply: [{$this->enquiry->reference}] {$this->enquiry->name}";
        if ($this->enquiry->product_name) {
            $subject .= " | {$this->enquiry->product_name}";
        }

        $escape = static fn ($val): string => htmlspecialchars((string) ($val ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $ref = $escape($this->enquiry->reference);
        $custName = $escape($this->enquiry->name);
        $custEmail = $escape($this->enquiry->email);
        $replyText = nl2br($escape($this->replyMessage->message));
        $product = $escape($this->enquiry->product_name ?: 'Custom Print Job');
        $formattedDate = $this->replyMessage->created_at?->format('d M Y, h:i A') ?? now()->format('d M Y, h:i A');

        $frontendUrl = ManualOrderService::getLiveFrontendUrl();
        $adminUrl = rtrim($frontendUrl, '/') . '/admin/enquiries/' . $this->enquiry->id;

        // Attachment details
        $attachmentSection = '';
        if ($this->replyMessage->attachment_path) {
            $attachmentUrl = ManualOrderService::formatLivePublicStorageUrl($this->replyMessage->attachment_path);
            $fileName = $escape($this->replyMessage->attachment_original_name ?: 'Artwork / Reference File');
            $attachmentSection = <<<HTML
              <div style="margin: 16px 0; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">📎 Customer Attached File</div>
                <div style="font-size: 13px; font-weight: 600; color: #15803d; margin-top: 2px;">{$fileName}</div>
                <div style="margin-top: 6px;">
                  <a href="{$attachmentUrl}" target="_blank" style="display: inline-block; padding: 6px 12px; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; border-radius: 6px;">Download Attached File</a>
                </div>
              </div>
HTML;
        }

        $html = <<<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><title>{$subject}</title></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <div style="max-width: 600px; margin: 24px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="padding: 24px 28px; background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); color: #ffffff;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7dd3fc; margin-bottom: 4px;">Quote Enquiry Update</div>
      <h1 style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #ffffff;">New Customer Response</h1>
      <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Reference: <strong style="color: #ffffff; font-family: monospace;">{$ref}</strong> &bull; {$formattedDate}</p>
    </div>

    <!-- Content -->
    <div style="padding: 28px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
        Customer: <strong style="color: #0f172a;">{$custName}</strong> (<a href="mailto:{$custEmail}" style="color: #0284c7;">{$custEmail}</a>)<br>
        Product: <strong style="color: #0f172a;">{$product}</strong>
      </div>

      <!-- Customer Message Card -->
      <div style="margin: 18px 0; padding: 18px 20px; background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 0 10px 10px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #059669; margin-bottom: 6px;">Customer Reply:</div>
        <div style="font-size: 14px; color: #0f172a; line-height: 1.6;">
          {$replyText}
        </div>
      </div>

      {$attachmentSection}

      <!-- Quick Action CTA -->
      <div style="margin: 28px 0 16px; text-align: center;">
        <a href="{$adminUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px;">
          View &amp; Reply in Admin Portal &rarr;
        </a>
      </div>

      <div style="text-align: center;">
        <a href="mailto:{$custEmail}?subject=Re:%20Quote%20Enquiry%20{$ref}" style="color: #0284c7; font-size: 12px; text-decoration: underline;">
          Or directly email customer at {$custEmail}
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding: 16px 28px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      Erry Imprints Automated Prepress &amp; Customer Enquiry System.
    </div>

  </div>
</body>
</html>
HTML;

        $mail = $this->from($fromEmail, $fromName)
            ->replyTo($this->enquiry->email, $this->enquiry->name)
            ->subject($subject)
            ->html($html);

        if ($this->replyMessage->attachment_path && Storage::disk('public')->exists($this->replyMessage->attachment_path)) {
            $fullPath = Storage::disk('public')->path($this->replyMessage->attachment_path);
            if (file_exists($fullPath) && filesize($fullPath) <= 20 * 1024 * 1024) {
                $mail->attach($fullPath, [
                    'as' => $this->replyMessage->attachment_original_name ?: basename($fullPath),
                    'mime' => $this->replyMessage->attachment_mime_type ?: 'application/octet-stream',
                ]);
            }
        }

        return $mail;
    }
}
