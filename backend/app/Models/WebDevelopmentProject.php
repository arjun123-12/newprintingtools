<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebDevelopmentProject extends Model
{
    protected $fillable = [
        'token', 'assigned_to', 'client_name', 'company_name', 'email', 'phone', 'project_name', 'website_url', 'live_website_url',
        'services', 'website_type', 'reference_urls', 'requirements', 'budget_range', 'requested_deadline',
        'status', 'quote_amount', 'quote_scope', 'quote_accepted_at', 'milestones', 'hosting_details', 'infrastructure', 'admin_notes',
    ];

    protected $casts = [
        'services' => 'array', 'milestones' => 'array', 'hosting_details' => 'array', 'infrastructure' => 'array',
        'requested_deadline' => 'date', 'quote_accepted_at' => 'datetime', 'quote_amount' => 'decimal:2',
    ];

    protected $hidden = ['token'];

    public function developer(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function messages(): HasMany { return $this->hasMany(WebProjectMessage::class, 'project_id'); }
    public function files(): HasMany { return $this->hasMany(WebProjectFile::class, 'project_id'); }
}
