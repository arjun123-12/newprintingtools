<?php

namespace App\Mail;

use App\Models\OfferCampaign;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OfferCampaignMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public OfferCampaign $campaign, public string $unsubscribeUrl) {}

    public function build(): self
    {
        return $this->from(config('mail.from.address', 'Info@erryimprints.com.au'), config('mail.from.name', 'Erry Imprints'))
            ->replyTo(config('mail.from.address', 'Info@erryimprints.com.au'))
            ->subject($this->campaign->subject)
            ->view('emails.offer-campaign');
    }
}
