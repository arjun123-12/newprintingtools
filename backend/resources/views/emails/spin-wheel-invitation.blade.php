<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ $subject ?? 'Spin to Win Your Exclusive Print Reward' }}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background: linear-gradient(180deg, #131b2e 0%, #0f172a 100%); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="padding: 32px 24px 20px; background: radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.22) 0%, transparent 70%); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; padding: 6px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 999px; font-size: 11px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; text-transform: uppercase;">
                ★ VIP Rewards Club ★
              </div>
              <h1 style="margin: 16px 0 6px; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                {{ $headline ?? "You've Unlocked a Free Spin!" }}
              </h1>
              <p style="margin: 0; font-size: 13px; color: #cbd5e1;">
                Erry Imprints • Design • Print • Grow
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 28px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #e2e8f0;">
                Dear {{ $customerName ?? 'Valued Customer' }},
              </p>
              
              <div style="font-size: 14px; color: #94a3b8; line-height: 1.7; margin-bottom: 24px;">
                {!! nl2br(e($messageText ?? "Thank you for completing your payment! As a special reward, you are invited to spin our prize wheel to unlock exclusive discounts, print credit, and free delivery upgrades on your next order.")) !!}
              </div>

              <!-- Graphic Wheel Teaser Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; background: rgba(15, 23, 42, 0.85); border: 2px dashed rgba(245, 158, 11, 0.4); border-radius: 16px; text-align: center;">
                <tr>
                  <td style="padding: 24px 16px;">
                    <div style="font-size: 40px; margin-bottom: 8px;">🎡</div>
                    <div style="font-size: 18px; font-weight: 800; color: #fbbf24; margin-bottom: 4px;">
                      SPIN & WIN PRIZES
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; max-width: 380px; margin: 0 auto 18px;">
                      Discounts up to 15% OFF, $20 Print Credits, Free Express Shipping & Premium Upgrades!
                    </div>
                    
                    <!-- Call To Action Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td align="center" style="background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); border-radius: 12px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45);">
                          <a href="{{ $spinUrl }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 800; color: #0f172a; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px;">
                            PLAY WHEEL & CLAIM REWARD →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              @if(!empty($orderNumber))
                <p style="margin: 12px 0 0; font-size: 12px; text-align: center; color: #64748b; font-family: monospace;">
                  Associated Order: #{{ $orderNumber }}
                </p>
              @endif
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 24px; background: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #64748b;">
              <p style="margin: 0 0 6px;">
                One spin per eligible paid customer. Reward codes are valid for future print orders.
              </p>
              <p style="margin: 0;">
                Erry Imprints · Info@erryimprints.com.au
                @if(!empty($unsubscribeUrl))
                  · <a href="{{ $unsubscribeUrl }}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a>
                @endif
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
