<?php

namespace App\Services\Notification;

use App\Models\CustomerEnquiry;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class OrderNotificationService
{
    /**
     * Official sender for Erry Imprints orders and customer communications.
     */
    public const DEFAULT_FROM_EMAIL = 'Info@erryimprints.com.au';
    public const DEFAULT_FROM_NAME = 'Erry Imprints';

    /**
     * Linked recipient for store orders, admin notifications, and enquiries.
     */
    public const LINKED_ADMIN_EMAIL = 'erryimprints@gmail.com';

    /**
     * Send order confirmation to customer and send notification copy to linked email.
     */
    public function sendOrderConfirmation(string $orderNumber, string $customerEmail, ?Order $order = null): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $linkedAdminEmail = env('ADMIN_ORDER_NOTIFICATION_EMAIL', env('ADMIN_NOTIFICATION_EMAIL', self::LINKED_ADMIN_EMAIL));

        $orderTotal = $order ? ('AUD $' . number_format((float) $order->total_inc_gst, 2)) : '';
        $customerName = $order?->user?->name ?? 'Customer';

        Log::info("Order notification dispatched for {$orderNumber}: customer={$customerEmail}, from={$fromEmail}, linkedAdmin={$linkedAdminEmail}");

        try {
            // 1. Send / Log order confirmation to customer
            Mail::raw(
                "Dear {$customerName},\n\nThank you for your order with Erry Imprints!\n\nOrder Number: {$orderNumber}\nTotal: {$orderTotal}\n\nOur prepress team is preparing your files for production. You can track your order status in your account dashboard.\n\nWarm regards,\nErry Imprints Team\nInfo@erryimprints.com.au",
                function ($message) use ($customerEmail, $orderNumber, $fromEmail, $fromName) {
                    $message->to($customerEmail)
                        ->from($fromEmail, $fromName)
                        ->replyTo($fromEmail, $fromName)
                        ->subject("Order Confirmation - {$orderNumber} | Erry Imprints");
                }
            );
        } catch (Throwable $e) {
            Log::warning("Could not send customer order email via SMTP: {$e->getMessage()}");
        }

        try {
            // 2. Send linked notification to erryimprints@gmail.com
            Mail::raw(
                "New Order Received!\n\nOrder Number: {$orderNumber}\nCustomer: {$customerName} ({$customerEmail})\nTotal: {$orderTotal}\nDate: " . now()->toRfc850String() . "\n\nPlease review in the Admin Operations Portal.",
                function ($message) use ($linkedAdminEmail, $orderNumber, $fromEmail, $fromName, $customerEmail) {
                    $message->to($linkedAdminEmail)
                        ->from($fromEmail, $fromName)
                        ->replyTo($customerEmail)
                        ->subject("🔔 New Order Alert: {$orderNumber} | Erry Imprints");
                }
            );
        } catch (Throwable $e) {
            Log::warning("Could not send admin order notification to {$linkedAdminEmail}: {$e->getMessage()}");
        }
    }

    /**
     * Send customer enquiry notification to linked email.
     */
    public function sendCustomerEnquiryNotification(CustomerEnquiry $enquiry): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $linkedAdminEmail = env('ADMIN_NOTIFICATION_EMAIL', self::LINKED_ADMIN_EMAIL);

        Log::info("Customer enquiry {$enquiry->reference} notification routed from {$fromEmail} to {$linkedAdminEmail}");

        try {
            Mail::raw(
                "New Customer Quote / Enquiry Received!\n\nReference: {$enquiry->reference}\nName: {$enquiry->name}\nEmail: {$enquiry->email}\nPhone: {$enquiry->phone}\nProduct: {$enquiry->product_name}\nQuantity: {$enquiry->quantity}\nLocation: {$enquiry->delivery_location}\n\nRequirements:\n{$enquiry->additional_requirements}\n\nPlease follow up with the customer via Erry Imprints Admin Portal.",
                function ($message) use ($linkedAdminEmail, $enquiry, $fromEmail, $fromName) {
                    $message->to($linkedAdminEmail)
                        ->from($fromEmail, $fromName)
                        ->replyTo($enquiry->email, $enquiry->name)
                        ->subject("📩 New Customer Enquiry: {$enquiry->reference} - {$enquiry->name} | Erry Imprints");
                }
            );
        } catch (Throwable $e) {
            Log::warning("Could not send enquiry email to {$linkedAdminEmail}: {$e->getMessage()}");
        }
    }

    /**
     * Send artwork status update to customer.
     */
    public function sendArtworkStatusUpdate(string $orderNumber, string $customerEmail, string $status): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));

        Log::info("Artwork status update dispatched for {$orderNumber}: status={$status}, customer={$customerEmail}, from={$fromEmail}");

        try {
            Mail::raw(
                "Hello,\n\nYour artwork status for order {$orderNumber} has been updated to: " . strtoupper($status) . ".\n\nWarm regards,\nErry Imprints Prepress Team\nInfo@erryimprints.com.au",
                function ($message) use ($customerEmail, $orderNumber, $status, $fromEmail, $fromName) {
                    $message->to($customerEmail)
                        ->from($fromEmail, $fromName)
                        ->replyTo($fromEmail, $fromName)
                        ->subject("Artwork Status Update: {$orderNumber} - " . ucfirst($status) . " | Erry Imprints");
                }
            );
        } catch (Throwable $e) {
            Log::warning("Could not send artwork update email via SMTP: {$e->getMessage()}");
        }
    }

    /**
     * Send proof review invitation with secure private link to customer.
     * Note: Internal notes are strictly excluded.
     */
    public function sendProofReviewInvitation(Order $order, string $reviewUrl, string $customerEmail): bool
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $customerName = $order->user?->name ?? 'Valued Customer';
        $orderNumber = $order->order_number;
        $proofVersion = 'V' . ($order->current_proof_version ?? 1);

        $customerNotesText = !empty($order->customer_notes)
            ? "\nSpecial Note from our team:\n\"{$order->customer_notes}\"\n"
            : "";

        $body = "Dear {$customerName},\n\n"
            . "Your artwork proof ({$proofVersion}) for order {$orderNumber} is ready for review.\n\n"
            . "Please review your proof carefully, verify all dimensions and contact details, and approve for printing or request changes using your secure review link:\n\n"
            . "{$reviewUrl}\n"
            . $customerNotesText . "\n"
            . "Once approved, you can complete payment directly on the portal to begin production immediately.\n\n"
            . "Warm regards,\n"
            . "Erry Imprints Prepress Team\n"
            . "Info@erryimprints.com.au";

        try {
            Mail::raw($body, function ($message) use ($customerEmail, $orderNumber, $fromEmail, $fromName) {
                $message->to($customerEmail)
                    ->from($fromEmail, $fromName)
                    ->replyTo($fromEmail, $fromName)
                    ->subject("Artwork Proof Ready for Review: {$orderNumber} | Erry Imprints");
            });
            Log::info("Proof review invitation sent successfully to {$customerEmail} for {$orderNumber}");
            return true;
        } catch (Throwable $e) {
            Log::warning("Failed sending proof review email to {$customerEmail}: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Alert staff when a customer submits a change request.
     */
    public function sendChangeRequestAlert(Order $order, string $comment): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $linkedAdminEmail = env('ADMIN_ORDER_NOTIFICATION_EMAIL', env('ADMIN_NOTIFICATION_EMAIL', self::LINKED_ADMIN_EMAIL));
        $orderNumber = $order->order_number;
        $customerName = $order->user?->name ?? 'Customer';

        $body = "⚠️ Customer Requested Changes on Order {$orderNumber}\n\n"
            . "Customer: {$customerName} ({$order->user?->email})\n"
            . "Order Total: AUD $" . number_format((float) $order->total_inc_gst, 2) . "\n"
            . "Date: " . now()->toRfc850String() . "\n\n"
            . "Customer Change Notes:\n"
            . "----------------------------------------\n"
            . "{$comment}\n"
            . "----------------------------------------\n\n"
            . "Please prepare a revised proof (V" . (($order->current_proof_version ?? 1) + 1) . ") in the Admin Portal.";

        try {
            Mail::raw($body, function ($message) use ($linkedAdminEmail, $orderNumber, $fromEmail, $fromName) {
                $message->to($linkedAdminEmail)
                    ->from($fromEmail, $fromName)
                    ->subject("⚠️ Artwork Change Requested: {$orderNumber} | Erry Imprints");
            });
        } catch (Throwable $e) {
            Log::warning("Failed sending change request alert to staff: {$e->getMessage()}");
        }
    }

    /**
     * Alert staff when a customer approves their artwork proof.
     */
    public function sendProofApprovalAlert(Order $order, int $version): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $linkedAdminEmail = env('ADMIN_ORDER_NOTIFICATION_EMAIL', env('ADMIN_NOTIFICATION_EMAIL', self::LINKED_ADMIN_EMAIL));
        $orderNumber = $order->order_number;
        $customerName = $order->user?->name ?? 'Customer';

        $body = "✅ Artwork Proof Approved: Order {$orderNumber}\n\n"
            . "Customer: {$customerName} ({$order->user?->email})\n"
            . "Approved Version: Proof V{$version}\n"
            . "Approved At: " . now()->toRfc850String() . "\n"
            . "Payment Status: " . strtoupper($order->payment_status->value ?? (string) $order->payment_status) . "\n\n"
            . "Order is waiting for payment confirmation before advancing to production.";

        try {
            Mail::raw($body, function ($message) use ($linkedAdminEmail, $orderNumber, $version, $fromEmail, $fromName) {
                $message->to($linkedAdminEmail)
                    ->from($fromEmail, $fromName)
                    ->subject("✅ Artwork Proof Approved (V{$version}): {$orderNumber} | Erry Imprints");
            });
        } catch (Throwable $e) {
            Log::warning("Failed sending proof approval alert to staff: {$e->getMessage()}");
        }
    }

    /**
     * Alert staff when payment is confirmed for an order.
     */
    public function sendPaymentConfirmedAlert(Order $order, float $amount, ?string $transactionId = null): void
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $linkedAdminEmail = env('ADMIN_ORDER_NOTIFICATION_EMAIL', env('ADMIN_NOTIFICATION_EMAIL', self::LINKED_ADMIN_EMAIL));
        $orderNumber = $order->order_number;
        $customerName = $order->user?->name ?? 'Customer';

        $body = "💳 Payment Confirmed for Order {$orderNumber}\n\n"
            . "Customer: {$customerName} ({$order->user?->email})\n"
            . "Amount: AUD $" . number_format($amount, 2) . "\n"
            . "Gateway: BPOINT\n"
            . "Transaction ID: " . ($transactionId ?? 'N/A') . "\n"
            . "Order Status: IN PRODUCTION\n"
            . "Timestamp: " . now()->toRfc850String() . "\n\n"
            . "Order has automatically entered the production print queue.";

        try {
            Mail::raw($body, function ($message) use ($linkedAdminEmail, $orderNumber, $fromEmail, $fromName) {
                $message->to($linkedAdminEmail)
                    ->from($fromEmail, $fromName)
                    ->subject("💳 Payment Received: {$orderNumber} - AUD In Production | Erry Imprints");
            });
        } catch (Throwable $e) {
            Log::warning("Failed sending payment confirmed alert to staff: {$e->getMessage()}");
        }
    }

    /**
     * Email the paid invoice to the customer after the gateway verifies payment.
     */
    public function sendPaidInvoice(Invoice $invoice, Order $order): bool
    {
        $customerEmail = $order->shipping_address['email'] ?? $order->user?->email;
        if (!$customerEmail) {
            Log::warning("Paid invoice {$invoice->invoice_number} has no customer email for order {$order->order_number}");
            return false;
        }

        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $escape = static fn ($value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $customerName = $escape($order->shipping_address['name'] ?? $order->user?->name ?? 'Customer');

        $rows = $order->items->map(function ($item) use ($escape): string {
            $name = $escape($item->product_name ?: 'Print product');
            $qty = (int) $item->quantity;
            $unitPrice = number_format((float) ($item->unit_price_ex_gst ?? 0), 2);
            $lineTotal = number_format((float) ($item->total_price_inc_gst ?? 0), 2);
            $unitPriceLabel = 'AUD $' . $unitPrice;
            $lineTotalLabel = 'AUD $' . $lineTotal;

            return "<tr><td style=\"padding:10px;border-bottom:1px solid #e2e8f0\">{$name}</td>"
                . "<td style=\"padding:10px;text-align:center;border-bottom:1px solid #e2e8f0\">{$qty}</td>"
                . "<td style=\"padding:10px;text-align:right;border-bottom:1px solid #e2e8f0\">{$unitPriceLabel}</td>"
                . "<td style=\"padding:10px;text-align:right;border-bottom:1px solid #e2e8f0\">{$lineTotalLabel}</td></tr>";
        })->implode('');

        $subtotal = number_format((float) $order->subtotal_ex_gst, 2);
        $gst = number_format((float) $order->gst_amount, 2);
        $shipping = number_format((float) $order->shipping_fee_inc_gst, 2);
        $discount = number_format((float) $order->discount_amount, 2);
        $total = number_format((float) $order->total_inc_gst, 2);
        $subtotalLabel = 'AUD $' . $subtotal;
        $gstLabel = 'AUD $' . $gst;
        $shippingLabel = 'AUD $' . $shipping;
        $discountLabel = 'AUD $' . $discount;
        $totalLabel = 'AUD $' . $total;
        $issuedAt = $invoice->issued_at?->format('d M Y') ?? now()->format('d M Y');
        $invoiceNumber = $escape($invoice->invoice_number);
        $orderNumber = $escape($order->order_number);
        $safeIssuedAt = $escape($issuedAt);

        $html = <<<HTML
<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:720px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="padding:24px;background:#0f172a;color:#fff">
      <h1 style="margin:0;font-size:22px">Erry Imprints</h1>
      <p style="margin:8px 0 0;color:#cbd5e1">Paid invoice</p>
    </div>
    <div style="padding:24px">
      <p>Hi {$customerName},</p>
      <p>We have confirmed your payment. Here is your invoice and order record.</p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b">Invoice</td><td style="text-align:right;font-weight:bold">{$invoiceNumber}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Order</td><td style="text-align:right">{$orderNumber}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Issue date</td><td style="text-align:right">{$safeIssuedAt}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Status</td><td style="text-align:right;color:#059669;font-weight:bold">PAID</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f1f5f9"><th style="padding:10px;text-align:left">Item</th><th style="padding:10px">Qty</th><th style="padding:10px;text-align:right">Unit (ex GST)</th><th style="padding:10px;text-align:right">Line total</th></tr></thead>
        <tbody>{$rows}</tbody>
      </table>
      <table style="width:100%;max-width:340px;margin:18px 0 0 auto;font-size:13px">
        <tr><td style="padding:5px;color:#64748b">Subtotal (ex GST)</td><td style="text-align:right">{$subtotalLabel}</td></tr>
        <tr><td style="padding:5px;color:#64748b">GST</td><td style="text-align:right">{$gstLabel}</td></tr>
        <tr><td style="padding:5px;color:#64748b">Shipping</td><td style="text-align:right">{$shippingLabel}</td></tr>
        <tr><td style="padding:5px;color:#64748b">Discount</td><td style="text-align:right">− {$discountLabel}</td></tr>
        <tr><td style="padding:10px 5px;border-top:1px solid #cbd5e1;font-weight:bold">Total paid (AUD)</td><td style="padding:10px 5px;border-top:1px solid #cbd5e1;text-align:right;font-weight:bold">{$totalLabel}</td></tr>
      </table>
      <p style="margin-top:24px;color:#64748b;font-size:13px">Thank you for choosing Erry Imprints.</p>
    </div>
  </div>
</body></html>
HTML;

        try {
            Mail::html($html, function ($message) use ($customerEmail, $invoice, $order, $fromEmail, $fromName) {
                $message->to($customerEmail)
                    ->from($fromEmail, $fromName)
                    ->replyTo($fromEmail, $fromName)
                    ->subject("Paid Invoice {$invoice->invoice_number} - Order {$order->order_number} | Erry Imprints");
            });
            Log::info("Paid invoice {$invoice->invoice_number} emailed to {$customerEmail}");
            return true;
        } catch (Throwable $e) {
            Log::warning("Could not email paid invoice {$invoice->invoice_number} to {$customerEmail}: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Send proof or payment reminder to customer with frequency check.
     */
    public function sendProofReminder(Order $order, string $reviewUrl, string $customerEmail, string $type = 'approval'): bool
    {
        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $customerName = $order->user?->name ?? 'Valued Customer';
        $orderNumber = $order->order_number;
        $proofVersion = 'V' . ($order->current_proof_version ?? 1);

        $subject = $type === 'payment'
            ? "Payment Reminder: Order {$orderNumber} | Erry Imprints"
            : "Artwork Review Reminder: Order {$orderNumber} ({$proofVersion}) | Erry Imprints";

        $body = "Dear {$customerName},\n\n"
            . "This is a friendly reminder regarding your order {$orderNumber}.\n\n"
            . ($type === 'payment'
                ? "Your artwork proof has been approved! Please complete your payment to begin production:\n\n{$reviewUrl}\n\n"
                : "Your artwork proof ({$proofVersion}) is awaiting your review and approval:\n\n{$reviewUrl}\n\n")
            . "Warm regards,\n"
            . "Erry Imprints Prepress Team\n"
            . "Info@erryimprints.com.au";

        try {
            Mail::raw($body, function ($message) use ($customerEmail, $subject, $fromEmail, $fromName) {
                $message->to($customerEmail)
                    ->from($fromEmail, $fromName)
                    ->replyTo($fromEmail, $fromName)
                    ->subject($subject);
            });
            return true;
        } catch (Throwable $e) {
            Log::warning("Failed sending reminder email to {$customerEmail}: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Send order production/shipping status update notification to customer.
     */
    public function sendOrderStatusUpdate(Order $order, string $newStatus, ?string $secureTrackingUrl = null, ?string $carrierTrackingUrl = null): bool
    {
        $customerEmail = $order->shipping_address['email'] ?? $order->user?->email;
        if (!$customerEmail) {
            Log::warning("No customer email found for order {$order->order_number} status notification ({$newStatus})");
            return false;
        }

        $fromEmail = config('mail.from.address', env('MAIL_FROM_ADDRESS', self::DEFAULT_FROM_EMAIL));
        $fromName = config('mail.from.name', env('MAIL_FROM_NAME', self::DEFAULT_FROM_NAME));
        $customerName = $order->shipping_address['name'] ?? $order->user?->name ?? 'Valued Customer';
        $orderNumber = $order->order_number;

        $statusLabel = match ($newStatus) {
            'production_started' => 'Production Started',
            'cutting_in_progress' => 'Cutting in Progress',
            'production_completed' => 'Production Completed',
            'ready_for_shipping' => 'Ready for Shipping',
            'handed_over_to_courier' => 'Handed Over to Courier',
            'delivered' => 'Delivered',
            'in_production' => 'In Production',
            'dispatched' => 'Dispatched',
            default => ucwords(str_replace('_', ' ', $newStatus)),
        };

        $shippingSection = "";
        if (!empty($order->shipping_carrier) || !empty($order->tracking_number)) {
            $shippingSection .= "\nShipping Details:\n";
            if (!empty($order->shipping_carrier)) {
                $shippingSection .= "• Carrier: {$order->shipping_carrier}\n";
            }
            if (!empty($order->tracking_number)) {
                $shippingSection .= "• Tracking Number: {$order->tracking_number}\n";
            }
            if (!empty($carrierTrackingUrl)) {
                $shippingSection .= "• Carrier Tracking Link: {$carrierTrackingUrl}\n";
            }
        }

        $trackingLinkSection = "";
        if (!empty($secureTrackingUrl)) {
            $trackingLinkSection = "\nYou can track your live order status and production history anytime at:\n{$secureTrackingUrl}\n";
        }

        $subject = "Order {$orderNumber} Update: {$statusLabel} | Erry Imprints";

        $body = "Dear {$customerName},\n\n"
            . "We are pleased to inform you that the status of your order {$orderNumber} has been updated to:\n\n"
            . ">>> {$statusLabel} <<<\n"
            . $shippingSection
            . $trackingLinkSection . "\n"
            . "Thank you for printing with Erry Imprints.\n\n"
            . "Warm regards,\n"
            . "Erry Imprints Production & Dispatch Team\n"
            . "Info@erryimprints.com.au";

        try {
            Mail::to($customerEmail)->send(new \App\Mail\OrderStatusUpdateMail(
                $order,
                $statusLabel,
                $secureTrackingUrl,
                $carrierTrackingUrl
            ));
            Log::info("Order status update notification ({$newStatus}) sent to {$customerEmail} for {$orderNumber}");
            return true;
        } catch (Throwable $e) {
            Log::warning("Failed sending order status email for {$orderNumber} to {$customerEmail}: {$e->getMessage()}");
            return false;
        }
    }
}
