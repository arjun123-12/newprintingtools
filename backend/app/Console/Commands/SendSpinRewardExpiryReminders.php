<?php

namespace App\Console\Commands;

use App\Models\CustomerRewardLedger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendSpinRewardExpiryReminders extends Command
{
    protected $signature = 'rewards:send-expiry-reminders';
    protected $description = 'Email customers once when an active Spin & Win reward is close to expiry';

    public function handle(): int
    {
        CustomerRewardLedger::query()
            ->with(['user:id,name,email', 'order:id,user_id,order_number,shipping_address'])
            ->where('status', 'active')
            ->whereNull('expiry_reminder_sent_at')
            ->whereNotNull('expires_at')
            ->whereBetween('expires_at', [now(), now()->addDays(3)])
            ->chunkById(100, function ($rewards) {
                foreach ($rewards as $reward) {
                    $email = $reward->user?->email
                        ?? $reward->order?->user?->email
                        ?? data_get($reward->order?->shipping_address, 'email');
                    if (!$email) continue;

                    $customerName = $reward->user?->name ?? $reward->order?->user?->name ?? 'Valued Customer';
                    $expiry = $reward->expires_at?->format('d M Y') ?? 'soon';
                    $amount = number_format((float) $reward->value, 2);
                    $value = $reward->reward_type === 'print_credit' ? 'AUD $' . $amount . ' print credit' : $reward->title;
                    $body = "Dear {$customerName},\n\n"
                        . "A reminder that your Spin & Win reward is due to expire on {$expiry}.\n\n"
                        . "Reward: {$reward->title}\nValue: {$value}\nCode: {$reward->reward_code}\n\n"
                        . "Sign in to your Erry Imprints account and apply this reward at checkout before it expires.\n\n"
                        . "Erry Imprints Team";

                    try {
                        Mail::raw($body, function ($message) use ($email, $reward) {
                            $message->to($email)->subject("Your Spin & Win reward expires soon: {$reward->title}");
                        });
                        $reward->forceFill(['expiry_reminder_sent_at' => now()])->save();
                    } catch (\Throwable $exception) {
                        Log::warning('Spin reward expiry reminder failed', [
                            'reward_id' => $reward->id,
                            'error' => $exception->getMessage(),
                        ]);
                    }
                }
            }, 'id');

        return self::SUCCESS;
    }
}
