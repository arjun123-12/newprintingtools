<?php

namespace App\Services\Notification;

use App\Models\CustomerEnquiry;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class OrderNotificationService
{
    /**
     * Official sender for Erry Imprints orders and customer communications.
     */
    public const DEFAULT_FROM_EMAIL = 'orders@erryimprints.com.au';
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
                "Dear {$customerName},\n\nThank you for your order with Erry Imprints!\n\nOrder Number: {$orderNumber}\nTotal: {$orderTotal}\n\nOur prepress team is preparing your files for production. You can track your order status in your account dashboard.\n\nWarm regards,\nErry Imprints Team\norders@erryimprints.com.au",
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
                "Hello,\n\nYour artwork status for order {$orderNumber} has been updated to: " . strtoupper($status) . ".\n\nWarm regards,\nErry Imprints Prepress Team\norders@erryimprints.com.au",
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
            . "orders@erryimprints.com.au";

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
            . "orders@erryimprints.com.au";

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
}
