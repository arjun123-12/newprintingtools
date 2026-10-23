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

    public const ROLE_SUPER_ADMIN = 'super_admin';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_STAFF = 'staff';
    public const ROLE_CUSTOMER = 'customer';

    /**
     * Stable canonical list of permissions controlling admin sections and APIs.
     */
    public const PERMISSIONS = [
        'dashboard' => [
            'name' => 'Dashboard',
            'description' => 'View performance metrics and overview',
            'category' => 'General',
        ],
        'orders' => [
            'name' => 'Orders',
            'description' => 'View, manage, and update order fulfillment statuses',
            'category' => 'Operations',
        ],
        'enquiries' => [
            'name' => 'Customer Enquiries',
            'description' => 'Manage customer support requests and contact submissions',
            'category' => 'Operations',
        ],
        'products' => [
            'name' => 'Products',
            'description' => 'Manage print product catalog, specs, and variants',
            'category' => 'Catalog',
        ],
        'categories' => [
            'name' => 'Categories',
            'description' => 'Create, edit, and organize product categories',
            'category' => 'Catalog',
        ],
        'templates' => [
            'name' => 'Templates',
            'description' => 'Design, publish, and delete customer artwork templates',
            'category' => 'Design',
        ],
        'design_assets' => [
            'name' => 'Design Assets',
            'description' => 'Manage graphics, fonts, stickers, and cliparts',
            'category' => 'Design',
        ],
        'artwork' => [
            'name' => 'Artwork Queue',
            'description' => 'Review preflight queues and customer artwork files',
            'category' => 'Design',
        ],
        'customers' => [
            'name' => 'Customers',
            'description' => 'View registered customers and business accounts',
            'category' => 'Customers',
        ],
        'pricing' => [
            'name' => 'Pricing Rules',
            'description' => 'Configure tier rates, quantity breaks, and markup calculations',
            'category' => 'Catalog',
        ],
        'invoices' => [
            'name' => 'Invoices',
            'description' => 'Generate and review AUD tax invoices and payments',
            'category' => 'Financial',
        ],
        'shipping' => [
            'name' => 'Shipping',
            'description' => 'Manage shipping carriers, parcel consignments, and tracking',
            'category' => 'Operations',
        ],
        'reports' => [
            'name' => 'Reports',
            'description' => 'View operational, revenue, and production analytics',
            'category' => 'General',
        ],
        'settings' => [
            'name' => 'Settings',
            'description' => 'Manage store configurations and platform settings',
            'category' => 'General',
        ],
    ];

    protected $fillable = [
        'name',
        'email',
        'phone',
        'company_name',
        'business_category',
        'abn',
        'role',
        'password',
        'is_super_admin',
        'is_active',
        'permissions',
        'role_preset',
        'must_change_password',
    ];

    protected $attributes = [
        'is_active' => true,
        'is_super_admin' => false,
        'must_change_password' => false,
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
            'is_super_admin' => 'boolean',
            'is_active' => 'boolean',
            'permissions' => 'array',
            'must_change_password' => 'boolean',
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

    public function assignedArtworks(): HasMany
    {
        return $this->hasMany(Artwork::class, 'assigned_designer_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Role & Permission Helpers
    |--------------------------------------------------------------------------
    */

    /**
     * Determines whether user has super admin status (full unrestricted access).
     */
    public function isSuperAdmin(): bool
    {
        if ((bool) $this->is_super_admin) {
            return true;
        }

        // Backward compatibility fallback: existing admin role without specific permissions
        if ($this->role === self::ROLE_ADMIN) {
            $perms = $this->permissions;
            return empty($perms) || $perms === [];
        }

        return false;
    }

    /**
     * Determines whether user has staff role.
     */
    public function isStaff(): bool
    {
        return $this->role === self::ROLE_STAFF;
    }

    /**
     * Checks if user is an administrator or staff member.
     */
    public function isAdmin(): bool
    {
        return (bool) $this->is_super_admin
            || $this->role === self::ROLE_ADMIN
            || $this->role === self::ROLE_STAFF;
    }

    /**
     * Checks whether user can log in to and use the admin panel.
     */
    public function canAccessAdminPanel(): bool
    {
        $active = $this->is_active ?? true;
        return (bool) $active && $this->isAdmin();
    }

    public function isCustomer(): bool
    {
        return $this->role === self::ROLE_CUSTOMER;
    }

    /**
     * Checks if user has a specific permission.
     * Super admins always have full access.
     * Deactivated users never have access.
     */
    public function hasPermission(string $permission): bool
    {
        $active = $this->is_active ?? true;
        if (!(bool) $active) {
            return false;
        }

        if ($this->isSuperAdmin()) {
            return true;
        }

        $perms = $this->permissions;
        if (is_string($perms)) {
            $perms = json_decode($perms, true) ?? [];
        }

        return is_array($perms) && in_array($permission, $perms, true);
    }

    /**
     * Returns the effective list of permission keys.
     * Super Admin gets all keys; staff gets their assigned keys.
     */
    public function getEffectivePermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return array_keys(self::PERMISSIONS);
        }

        $perms = $this->permissions;
        if (is_string($perms)) {
            $perms = json_decode($perms, true) ?? [];
        }

        return is_array($perms) ? array_values($perms) : [];
    }

    /**
     * Determines if user is acting as a scoped designer:
     * Sees only their assigned submissions and cannot view pricing, payments, or admin_notes.
     */
    public function isRestrictedDesigner(): bool
    {
        if ($this->isSuperAdmin()) {
            return false;
        }

        // If user has orders or pricing or invoices permission, they have broad admin visibility
        if ($this->hasPermission('orders') || $this->hasPermission('pricing') || $this->hasPermission('invoices')) {
            return false;
        }

        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Token Permission Helpers
    |--------------------------------------------------------------------------
    */

    public function canCreateTemplates(): bool
    {
        return $this->hasPermission('templates');
    }

    public function canReadTemplates(): bool
    {
        return $this->hasPermission('templates');
    }

    public function canUpdateTemplates(): bool
    {
        return $this->hasPermission('templates');
    }

    public function canDeleteTemplates(): bool
    {
        return $this->hasPermission('templates');
    }

    public function spinEntitlements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(OrderSpinEntitlement::class);
    }

    public function rewardLedgers(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CustomerRewardLedger::class);
    }
}