<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferCampaignRecipient extends Model
{
    protected $fillable = [
        'campaign_id',
        'user_id',
        'marketing_contact_id',
        'email',
        'unsubscribe_token_hash',
        'status',
        'error',
        'sent_at',
    ];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }
}
