<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_CUSTOMER = 'customer';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'company_name',
        'abn',
        'role',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function addresses(): HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function artworks(): HasMany
    {
        return $this->hasMany(Artwork::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Role Helpers
    |--------------------------------------------------------------------------
    */

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isCustomer(): bool
    {
        return $this->role === self::ROLE_CUSTOMER;
    }

    /*
    |--------------------------------------------------------------------------
    | Token Permission Helpers
    |--------------------------------------------------------------------------
    */

    public function canCreateTemplates(): bool
    {
        return $this->isAdmin()
            && $this->tokenCan('templates:create');
    }

    public function canReadTemplates(): bool
    {
        return $this->isAdmin()
            && $this->tokenCan('templates:read');
    }

    public function canUpdateTemplates(): bool
    {
        return $this->isAdmin()
            && $this->tokenCan('templates:update');
    }

    public function canDeleteTemplates(): bool
    {
        return $this->isAdmin()
            && $this->tokenCan('templates:delete');
    }
}