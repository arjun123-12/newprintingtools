<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfferCampaign extends Model
{
    protected $fillable = ['offer_id', 'subject', 'headline', 'message', 'status', 'recipient_count', 'sent_count', 'failed_count', 'created_by', 'sent_at'];
    protected function casts(): array { return ['sent_at' => 'datetime']; }
    public function offer(): BelongsTo { return $this->belongsTo(Offer::class); }
    public function recipients(): HasMany { return $this->hasMany(OfferCampaignRecipient::class, 'campaign_id'); }
}
