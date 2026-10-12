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
}
