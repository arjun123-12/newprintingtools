<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketingContact extends Model
{
    protected $fillable = ['name', 'email', 'marketing_consent', 'marketing_consent_at', 'unsubscribed_at', 'created_by'];
    protected function casts(): array
    {
        return ['marketing_consent' => 'boolean', 'marketing_consent_at' => 'datetime', 'unsubscribed_at' => 'datetime'];
    }
}
