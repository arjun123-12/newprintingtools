<?php

namespace App\Mail;

use App\Models\CustomerEnquiry;
use App\Models\CustomerEnquiryMessage;
use App\Services\Order\ManualOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class CustomerEnquiryAdminReplyMail extends Mailable
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

        $subject = "Reply to your Quote Enquiry [{$this->enquiry->reference}] | Erry Imprints";

        $escape = static fn ($val): string => htmlspecialchars((string) ($val ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $conversationUrl = $this->enquiry->conversation_url;
        $ref = $escape($this->enquiry->reference);
        $custName = $escape($this->enquiry->name);
        $senderName = $escape($this->replyMessage->sender_name ?: 'Erry Imprints Prepress Team');
        $replyText = nl2br($escape($this->replyMessage->message));
        $product = $escape($this->enquiry->product_name ?: 'Custom Print Job');

        // Attachment details if admin attached a proof / quote file
        $attachmentSection = '';
        if ($this->replyMessage->attachment_path) {
            $attachmentUrl = ManualOrderService::formatLivePublicStorageUrl($this->replyMessage->attachment_path);
            $fileName = $escape($this->replyMessage->attachment_original_name ?: 'Attached Document');
            $attachmentSection = <<<HTML
              <div style="margin: 16px 0; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">📎 Attached File</div>
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
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7dd3fc; margin-bottom: 4px;">Erry Imprints &bull; Prepress &amp; Customer Support</div>
      <h1 style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #ffffff;">New Message Regarding Your Quote</h1>
      <p style="margin: 0; font-size: 13px; color: #cbd5e1;">Enquiry Reference: <strong style="color: #ffffff; font-family: monospace;">{$ref}</strong> &bull; {$product}</p>
    </div>

    <!-- Content -->
    <div style="padding: 28px;">
      <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Hi <strong>{$custName}</strong>,</p>
      
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Our team has responded to your quote enquiry regarding <strong>{$product}</strong>:
      </p>

      <!-- Message Bubble -->
      <div style="margin: 20px 0; padding: 18px 20px; background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 0 10px 10px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #0284c7; margin-bottom: 6px;">{$senderName}:</div>
        <div style="font-size: 14px; color: #0f172a; line-height: 1.6;">
          {$replyText}
        </div>
      </div>

      {$attachmentSection}

      <!-- CTA Button to open secure conversation link -->
      <div style="margin: 28px 0; text-align: center;">
        <a href="{$conversationUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
          Open Conversation &amp; Reply Online &rarr;
        </a>
        <p style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
          You can view your entire project history and upload additional artwork anytime via this secure link without needing a password.
        </p>
      </div>

      <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
        If you have trouble clicking the button, copy and paste this link into your browser:<br>
        <a href="{$conversationUrl}" style="color: #0284c7; word-break: break-all;">{$conversationUrl}</a>
      </div>

      <p style="margin-top: 20px; margin-bottom: 0; font-size: 13px; color: #334155;">
        Warm regards,<br>
        <strong>Erry Imprints Team</strong><br>
        <span style="color: #64748b; font-size: 12px;">info@erryimprints.com.au</span>
      </p>

    </div>

    <!-- Footer -->
    <div style="padding: 16px 28px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      &copy; " . date('Y') . " Erry Imprints Australia. All rights reserved.
    </div>

  </div>
</body>
</html>
HTML;

        $mail = $this->from($fromEmail, $fromName)
            ->replyTo($fromEmail, $fromName)
            ->subject($subject)
            ->html($html);

        // Attach file directly if under 20MB
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
