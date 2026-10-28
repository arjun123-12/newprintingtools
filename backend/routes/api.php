<?php

use App\Http\Controllers\Api\V1\Admin\DesignTemplates\DesignTemplateController;
use App\Http\Controllers\Api\V1\Admin\Designer\DesignAssetCategoryController;
use App\Http\Controllers\Api\V1\Admin\Designer\DesignAssetController;
use App\Http\Controllers\Api\V1\Artwork\ArtworkController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Customers\CustomerController;
use App\Http\Controllers\Api\V1\Designer\DesignerController;
use App\Http\Controllers\Api\V1\Designer\UploadController;
use App\Http\Controllers\Api\V1\Freepik\IconSearchController;
use App\Http\Controllers\Api\V1\Freepik\RemoveBackgroundController;
use App\Http\Controllers\Api\V1\Freepik\ResourceController;
use App\Http\Controllers\Api\V1\Freepik\SearchController;
use App\Http\Controllers\Api\V1\Freepik\UseAssetController;
use App\Http\Controllers\Api\V1\Freepik\UseIconController;
use App\Http\Controllers\Api\V1\ImageQualityController;
use App\Http\Controllers\Api\V1\Designer\ExportController;
use App\Http\Controllers\Api\V1\ClientBriefController;
use App\Http\Controllers\Api\V1\Admin\ClientBriefController as AdminClientBriefController;
use App\Http\Controllers\Api\V1\ClientBriefAuthController;
use App\Http\Controllers\Api\V1\Payments\PaymentController;
use App\Http\Controllers\Api\V1\Admin\Staff\StaffController;
use Illuminate\Support\Facades\Route;
/*
|--------------------------------------------------------------------------
| API V1 Routes
|--------------------------------------------------------------------------
|
| Base URI: /api/v1/
|
*/

// Health Check
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'app' => config('app.name'),
        'version' => 'v1',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// Designer image uploads and format conversion.
// Stored-image routes return permanent URLs so Fabric canvas JSON never
// contains data:image/base64 or blob: image sources.
Route::prefix('designer/uploads')
    ->middleware('throttle:60,1')
    ->group(function () {
        Route::post('/canvas-image', [
            UploadController::class,
            'storeCanvasImage',
        ]);

        // Convert PDF and TIFF to browser-safe PNG preview for Fabric.js.
        Route::match(['get', 'post'], '/convert-image', [
            UploadController::class,
            'convertImage',
        ])->middleware('throttle:60,1');

        Route::post('/processed-image', [
            UploadController::class,
            'storeProcessedImage',
        ]);
    });

// PSD layer asset uploads (authenticated with auth:sanctum)
Route::post('designer/psd-assets', [
    UploadController::class,
    'storePsdAsset',
])->middleware(['auth:sanctum', 'throttle:120,1']);

// Image Quality Analysis and Local Real-ESRGAN Upscaling
Route::prefix('images')->group(function () {
    Route::post('/analyze-quality', [ImageQualityController::class, 'analyzeQuality']);
    Route::post('/register', [ImageQualityController::class, 'registerImage']);
    Route::post('/{image}/upscale', [ImageQualityController::class, 'upscale']);
    Route::get('/{image}/upscale-status', [ImageQualityController::class, 'upscaleStatus']);
});

// Multi-Format Designer Export Engine (JPEG, PNG, WebP, PDF, TIFF, PSD)
Route::prefix('designer')->group(function () {
    Route::post('/export', [ExportController::class, 'export']);
    Route::post('/export/print', [ExportController::class, 'exportPrint']);
    Route::get('/exports/{export}/status', [ExportController::class, 'status']);
    Route::get('/exports/{export}/download', [ExportController::class, 'download']);
});

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Client Brief - private token link used by customers.
// NOTE: This routes file already uses /api/v1 as its base URI, so do not
// add another "v1" prefix here.
Route::prefix('client-brief')
    ->middleware('throttle:60,1')
    ->group(function () {
        Route::get('/{token}', [
            ClientBriefController::class,
            'show',
        ])->where('token', '[A-Za-z0-9]+');

        Route::post('/{token}/submit', [
            ClientBriefController::class,
            'submit',
        ])
            ->where('token', '[A-Za-z0-9]+')
            ->middleware('throttle:20,1');
    });

// Customer Proof Review & Approval Portal (unguessable token link)
Route::prefix('order-review')
    ->middleware('throttle:60,1')
    ->group(function () {
        Route::get('/{token}', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'show',
        ])->where('token', '[A-Za-z0-9_-]+');

        Route::post('/{token}/request-changes', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'requestChanges',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:20,1');

        Route::post('/{token}/approve', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'approve',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:20,1');

        Route::post('/{token}/payment-session', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'createPaymentSession',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:20,1');

        Route::post('/{token}/process-payment', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'processPayment',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:20,1');

        Route::get('/{token}/spin-eligibility', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'spinEligibility',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:60,1');

        Route::post('/{token}/spin', [
            \App\Http\Controllers\Api\V1\Public\CustomerOrderReviewController::class,
            'spin',
        ])->where('token', '[A-Za-z0-9_-]+')->middleware('throttle:20,1');
    });

// ==========================================
// SPIN & WIN REWARDS (PUBLIC & CUSTOMER VERIFIED)
// ==========================================
Route::prefix('spin-win')->group(function () {
    Route::get('/eligibility', [\App\Http\Controllers\Api\V1\Rewards\SpinRewardController::class, 'checkEligibility'])
        ->middleware('throttle:60,1');
    Route::post('/spin', [\App\Http\Controllers\Api\V1\Rewards\SpinRewardController::class, 'spin'])
        ->middleware('throttle:20,1');
    Route::post('/validate-voucher', [\App\Http\Controllers\Api\V1\Rewards\SpinRewardController::class, 'validateReward'])
        ->middleware('throttle:30,1');
    Route::get('/categories', [\App\Http\Controllers\Api\V1\Rewards\SpinRewardController::class, 'getCategories'])
        ->middleware('throttle:60,1');
});

// Catalog
Route::prefix('products')->group(function () {
    Route::get('/', [
        App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
        'index',
    ]);

    Route::get('/{id}', [
        App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
        'show',
    ]);
});

// Categories
Route::prefix('categories')->group(function () {
    Route::get('/', [
        App\Http\Controllers\Api\V1\Categories\CategoryController::class,
        'index',
    ]);

    Route::get('/{slug}', [
        App\Http\Controllers\Api\V1\Categories\CategoryController::class,
        'show',
    ]);
});

// Pricing
Route::post('/pricing/calculate', [
    App\Http\Controllers\Api\V1\Pricing\PricingController::class,
    'calculate',
]);

// Public active templates
Route::get('/designer/templates/{productId}', [
    DesignerController::class,
    'templates',
]);
Route::get('/designer/templates/{productId}/{templateId}', [
    DesignerController::class,
    'showTemplate',
]);

// Public designer assets
Route::get('/designer/asset-categories', [
    App\Http\Controllers\Api\V1\Public\Designer\DesignAssetController::class,
    'categories',
]);
Route::get('/designer/assets', [
    App\Http\Controllers\Api\V1\Public\Designer\DesignAssetController::class,
    'index',
]);
Route::get('/designer/assets/{id}', [
    App\Http\Controllers\Api\V1\Public\Designer\DesignAssetController::class,
    'show',
]);

// Public, CORS-safe access to images generated by the background-removal
// service. The response is sent through Laravel instead of directly through
// public/storage, so the global HandleCors middleware can add the correct
// Access-Control-Allow-Origin header required by Fabric.js.
//
// Keep this route outside auth:sanctum. Fabric loads the returned image URL as
// an anonymous browser image request and therefore cannot attach a bearer token.
Route::get('/designer/removed-backgrounds/{filename}', [
    DesignerController::class,
    'serveRemovedBackground',
])
    ->where('filename', '[A-Za-z0-9._-]+')
    ->name('designer.removed-backgrounds.show');

// External Assets (Normalized Aggregator)
Route::prefix('designer/external-assets')->group(function () {
    Route::get('/categories', [App\Http\Controllers\Api\V1\Designer\ExternalAssetController::class, 'categories']);
    Route::get('/search', [App\Http\Controllers\Api\V1\Designer\ExternalAssetController::class, 'search']);
    Route::get('/{provider}/{id}', [App\Http\Controllers\Api\V1\Designer\ExternalAssetController::class, 'show']);
    Route::post('/{provider}/{id}/use', [App\Http\Controllers\Api\V1\Designer\ExternalAssetController::class, 'useAsset']);
});

// Optional alias for loading all active templates
Route::get('/templates', [
    DesignerController::class,
    'templates',
]);

// Freepik / Magnific Assets
Route::prefix('freepik')->group(function () {
    Route::get('/search', SearchController::class);
    Route::get('/resources/{id}', ResourceController::class);
    Route::post('/resources/{id}/use', UseAssetController::class);
    Route::post('/remove-background', RemoveBackgroundController::class);
    
    // Icons API
    Route::get('/icons/search', IconSearchController::class);
    Route::post('/icons/{id}/use', UseIconController::class);
});

// CORS-safe image access
Route::get('/designer/proxy-image', [
    DesignerController::class,
    'proxyImage',
]);

// Customer artwork APIs (supports both authenticated customers and guest sessions)
Route::prefix('artworks')->group(function () {
    Route::get('/', [ArtworkController::class, 'index']);
    Route::post('/', [ArtworkController::class, 'store']);
    Route::post('/draft', [ArtworkController::class, 'storeDraft']);
    Route::post('/presign-upload', [ArtworkController::class, 'presign']);
    Route::post('/verify', [ArtworkController::class, 'verify']);
    Route::get('/{artwork}', [ArtworkController::class, 'show']);
    Route::get('/{artworkId}/public', [ArtworkController::class, 'showPublic']);
    Route::match(['put', 'patch'], '/{artwork}', [ArtworkController::class, 'update']);
    Route::put('/{artwork}/public', [ArtworkController::class, 'update']);
    Route::post('/{artwork}/complete', [ArtworkController::class, 'complete']);
    Route::delete('/{artwork}', [ArtworkController::class, 'destroy']);
});

Route::get('/storage/{path}', [
    DesignerController::class,
    'serveStorage',
])->where('path', '.*');

// ==========================================
// AUTHENTICATION
// ==========================================

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::post('/register', [AuthController::class, 'register']);
});

// ==========================================
// CUSTOMER ENQUIRIES (PUBLIC)
// ==========================================

Route::post('/enquiries', [
    App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
    'store',
])->middleware('throttle:30,1');

// Secure customer conversation thread (token-based unguessable access)
Route::prefix('enquiries/conversation/{token}')->group(function () {
    Route::get('/', [
        App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
        'showConversation',
    ])->middleware('throttle:60,1');

    Route::post('/reply', [
        App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
        'sendCustomerMessage',
    ])->middleware('throttle:20,1');
});

// Live AI Support Chat (Visitor / Customer Session)
Route::prefix('chat')->group(function () {
    Route::post('/message', [
        App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
        'sendChatMessage',
    ])->middleware('throttle:30,1');

    Route::get('/history', [
        App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
        'getChatHistory',
    ])->middleware('throttle:60,1');
});

// ==========================================
// GUEST CART
// ==========================================

Route::prefix('cart')->group(function () {
    Route::get('/', [
        App\Http\Controllers\Api\V1\Cart\CartController::class,
        'getCart',
    ]);

    Route::post('/items', [
        App\Http\Controllers\Api\V1\Cart\CartController::class,
        'addItem',
    ]);

    Route::put('/items/{itemId}', [
        App\Http\Controllers\Api\V1\Cart\CartController::class,
        'updateItem',
    ]);

    Route::delete('/items/{itemId}', [
        App\Http\Controllers\Api\V1\Cart\CartController::class,
        'removeItem',
    ]);

    Route::delete('/', [
        App\Http\Controllers\Api\V1\Cart\CartController::class,
        'clearCart',
    ]);
});

// ==========================================
// AUTHENTICATED CUSTOMER ROUTES
// ==========================================

Route::middleware(['auth:sanctum'])->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);

        Route::post('/change-password', [AuthController::class, 'changePassword']);

        Route::post('/logout', [AuthController::class, 'logout']);
    });

    Route::prefix('customers')->group(function () {
        Route::get('/profile', [CustomerController::class, 'profile']);

        Route::put('/profile', [CustomerController::class, 'updateProfile']);
    });

    Route::prefix('customer')->group(function () {
        Route::get('/profile', [CustomerController::class, 'profile']);

        Route::put('/profile', [CustomerController::class, 'updateProfile']);
    });

    Route::prefix('orders')->group(function () {
        Route::get('/', [
            App\Http\Controllers\Api\V1\Orders\OrderController::class,
            'index',
        ]);

        Route::post('/', [
            App\Http\Controllers\Api\V1\Orders\OrderController::class,
            'store',
        ]);

        Route::get('/{orderNumber}', [
            App\Http\Controllers\Api\V1\Orders\OrderController::class,
            'show',
        ]);

        Route::post(
            '/{orderNumber}/payment-session',
            [PaymentController::class, 'createSession']
        );

        Route::post(
            '/{orderNumber}/process-payment',
            [PaymentController::class, 'processPayment']
        );

        Route::get(
            '/{orderNumber}/tracking',
            [App\Http\Controllers\Api\V1\Admin\AdminShippingController::class, 'customerTracking']
        );
    });

    Route::prefix('checkout')->group(function () {
        Route::get('/data', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'getCheckoutData',
        ]);

        Route::post('/shipping-rates', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'getShippingRates',
        ]);

        Route::get('/locations', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'searchLocations',
        ]);

        Route::post('/validate', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'validateCheckout',
        ]);

        Route::post('/process', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'process',
        ]);
    });

    Route::prefix('addresses')->group(function () {
        Route::get('/', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'getAddresses',
        ]);

        Route::post('/', [
            App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
            'saveAddress',
        ]);
    });

    Route::prefix('rewards')->group(function () {
        Route::get('/my-rewards', [\App\Http\Controllers\Api\V1\Rewards\SpinRewardController::class, 'customerRewards']);
    });
});

// ==========================================
// AUTHENTICATED ADMIN ROUTES
// ==========================================

Route::middleware(['auth:sanctum', 'admin.access'])
    ->prefix('admin')
    ->group(function () {

        // Categories (permission: categories)
        Route::middleware('permission:categories')->group(function () {
            Route::get('/categories/archived', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'archived',
            ]);

            Route::post('/categories/bulk-restore', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'bulkRestore',
            ]);

            Route::post('/categories/bulk-archive', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'bulkArchive',
            ]);

            Route::post('/categories/{id}/restore', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'restore',
            ]);

            Route::post('/categories/{id}/archive', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'archive',
            ]);

            Route::get('/categories', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'adminIndex',
            ]);

            Route::post('/categories', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'store',
            ]);

            Route::patch('/categories/{id}', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'update',
            ]);

            Route::delete('/categories/{id}', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'destroy',
            ]);
            Route::post('/categories/bulk-delete', [
                App\Http\Controllers\Api\V1\Categories\CategoryController::class,
                'bulkDestroy',
            ]);
        });

        // Products (permission: products)
        Route::middleware('permission:products')->group(function () {
            Route::get('/products/archived', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'archived',
            ]);

            Route::post('/products/bulk-restore', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'bulkRestore',
            ]);

            Route::post('/products/bulk-archive', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'bulkArchive',
            ]);

            Route::post('/products/{id}/restore', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'restore',
            ]);

            Route::post('/products/{id}/archive', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'archive',
            ]);

            Route::post('/products/{id}/duplicate', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'duplicate',
            ]);

            Route::get('/products', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'index',
            ]);

            Route::post('/products', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'store',
            ]);

            Route::post('/products/bulk-delete', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'bulkDestroy',
            ]);

            Route::get('/products/{id}', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'show',
            ]);

            Route::patch('/products/{id}', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'update',
            ]);

            Route::delete('/products/{id}', [
                App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
                'destroy',
            ]);

            Route::post('/products/{id}/images', [
                App\Http\Controllers\Api\V1\Admin\ProductImages\ProductImageController::class,
                'store',
            ]);

            Route::apiResource(
                'products.variants',
                App\Http\Controllers\Api\V1\Admin\ProductVariants\ProductVariantController::class
            );
        });

        // Design templates (permission: templates)
        Route::middleware('permission:templates')->group(function () {
            Route::post('/design-templates/bulk-delete', [DesignTemplateController::class, 'bulkDestroy']);
            Route::get('/design-templates', [DesignTemplateController::class, 'index']);
            Route::post('/design-templates', [DesignTemplateController::class, 'store']);
            Route::get('/design-templates/{template}', [DesignTemplateController::class, 'show']);
            Route::match(['put', 'patch'], '/design-templates/{template}', [
                DesignTemplateController::class,
                'update',
            ]);
            Route::delete('/design-templates/{template}', [DesignTemplateController::class, 'destroy']);

            // Admin template APIs
            Route::post('/templates/bulk-delete', [DesignTemplateController::class, 'bulkDestroy']);
            Route::get('/templates', [DesignTemplateController::class, 'index']);
            Route::post('/templates', [DesignTemplateController::class, 'store']);
            Route::get('/templates/{template}', [DesignTemplateController::class, 'show']);
            Route::match(['put', 'patch'], '/templates/{template}', [
                DesignTemplateController::class,
                'update',
            ]);
            Route::delete('/templates/{template}', [DesignTemplateController::class, 'destroy']);
        });
        
        // Designer Assets (permission: design_assets)
        Route::middleware('permission:design_assets')->group(function () {
            Route::post('/designer/asset-categories/bulk-delete', [
                DesignAssetCategoryController::class,
                'bulkDestroy',
            ])->name('designer.asset-categories.bulk-destroy');

            Route::post('/designer/assets/bulk-delete', [
                DesignAssetController::class,
                'bulkDestroy',
            ])->name('designer.assets.bulk-destroy');

            Route::apiResource(
                '/designer/asset-categories',
                DesignAssetCategoryController::class
            );

            Route::apiResource(
                '/designer/assets',
                DesignAssetController::class
            );
        });

        // Dashboard Metrics (permission: dashboard)
        Route::get('/metrics', [
            App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class,
            'metrics',
        ])->middleware('permission:dashboard');

        // Orders (permission: orders)
        Route::middleware('permission:orders')->group(function () {
            Route::get('/orders', [
                App\Http\Controllers\Api\V1\Admin\AdminOrderController::class,
                'index',
            ]);

            Route::get('/orders/{id}', [
                App\Http\Controllers\Api\V1\Admin\AdminOrderController::class,
                'show',
            ]);

            Route::patch('/orders/{id}/status', [
                App\Http\Controllers\Api\V1\Admin\AdminOrderController::class,
                'updateStatus',
            ]);

            // Manual Orders & Proofing Portal (permission: orders)
            Route::get('/manual-orders', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'index',
            ]);
            Route::post('/manual-orders/calculate', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'calculate',
            ]);
            Route::post('/manual-orders', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'store',
            ]);
            Route::get('/manual-orders/{id}', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'show',
            ]);
            Route::put('/manual-orders/{id}', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'update',
            ]);
            Route::post('/manual-orders/{id}/proofs', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'uploadProof',
            ]);
            Route::post('/manual-orders/{id}/items/{itemId}/artwork', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'attachArtwork',
            ]);
            Route::post('/manual-orders/{id}/send-for-approval', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'sendForApproval',
            ]);
            Route::post('/manual-orders/{id}/regenerate-link', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'regenerateLink',
            ]);
            Route::post('/manual-orders/{id}/revoke-link', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'revokeLink',
            ]);
            Route::post('/manual-orders/{id}/send-reminder', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'sendReminder',
            ]);
            Route::post('/manual-orders/{id}/move-to-production', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'moveToProduction',
            ]);
            Route::post('/manual-orders/{id}/production-status', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'updateProductionStatus',
            ]);
            Route::match(['post', 'patch'], '/manual-orders/{id}/turnaround', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'updateTurnaround',
            ]);
            Route::delete('/manual-orders/{id}', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'destroy',
            ]);
            Route::delete('/manual-orders/{id}/items/{itemId}', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'destroyItem',
            ]);
            Route::delete('/orders/{id}', [
                \App\Http\Controllers\Api\V1\Admin\ManualOrderController::class,
                'destroy',
            ]);
        });

        // Tax Invoices (AUD) & Payments (permission: invoices)
        Route::middleware('permission:invoices')->group(function () {
            Route::get('/invoices', [
                App\Http\Controllers\Api\V1\Admin\AdminInvoiceController::class,
                'index',
            ]);
            Route::post('/invoices', [
                App\Http\Controllers\Api\V1\Admin\AdminInvoiceController::class,
                'store',
            ]);
            Route::get('/invoices/{id}', [
                App\Http\Controllers\Api\V1\Admin\AdminInvoiceController::class,
                'show',
            ]);
            Route::put('/invoices/{id}', [
                App\Http\Controllers\Api\V1\Admin\AdminInvoiceController::class,
                'update',
            ]);
            Route::delete('/invoices/{id}', [
                App\Http\Controllers\Api\V1\Admin\AdminInvoiceController::class,
                'destroy',
            ]);
        });

        // Artwork Preflight & Review Queue (permission: artwork)
        Route::middleware('permission:artwork')->prefix('artwork-queue')->group(function () {
            Route::get('/', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'queue']);
            Route::get('/designers', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'designers']);
            Route::get('/{id}', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'show']);
            Route::get('/{id}/download', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'download']);
            Route::post('/{id}/generate-proof', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'generateProof']);
            Route::post('/{id}/approve', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'approve']);
            Route::post('/{id}/request-changes', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'requestChanges']);
            Route::post('/{id}/assign-designer', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'assignDesigner']);
            Route::post('/{id}/preflight', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'runPreflight']);
            Route::post('/{id}/upload-version', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'uploadVersion']);
        });

        // Customer & Artwork Management (permission: customers)
        Route::middleware('permission:customers')->group(function () {
            Route::get('/customers', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'index',
            ]);
            Route::post('/customers', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'store',
            ]);
            Route::post('/customers/import/preview', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'importPreview',
            ]);
            Route::post('/customers/import', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'import',
            ]);
            Route::post('/customers/import/download-report', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'downloadImportReport',
            ]);
            Route::get('/customers/guest-artworks', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'guestArtworks',
            ]);
            Route::get('/customers/{id}', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'show',
            ]);
            Route::put('/customers/{id}', [
                App\Http\Controllers\Api\V1\Admin\CustomerController::class,
                'update',
            ]);
        });

        // Customer Enquiries Management (permission: enquiries)
        Route::middleware('permission:enquiries')->group(function () {
            Route::get('/enquiries', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'index',
            ]);
            Route::get('/enquiries/{id}', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'show',
            ]);
            Route::patch('/enquiries/{id}', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'update',
            ]);
            Route::delete('/enquiries/{id}', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'destroy',
            ]);
            Route::get('/enquiries/{id}/messages', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'getAdminMessages',
            ]);
            Route::post('/enquiries/{id}/messages', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'sendAdminMessage',
            ]);
            Route::post('/enquiries/{id}/toggle-ai', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'toggleAi',
            ]);
            Route::post('/enquiries/{id}/resolve-followup', [
                App\Http\Controllers\Api\V1\Enquiries\CustomerEnquiryController::class,
                'resolveFollowup',
            ]);
        });

        // Shipping Management & CouriersPlease Carrier Integration (permission: shipping)
        Route::prefix('shipping')->middleware('permission:shipping')->group(function () {
            Route::get('/status', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'status',
            ]);
            Route::post('/origin', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'updateOrigin',
            ]);
            Route::get('/orders', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'orders',
            ]);
            Route::post('/orders/{id}/create-shipment', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'createShipment',
            ]);
            Route::get('/shipments/{consignmentNumber}/label', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'downloadLabel',
            ]);
            Route::get('/shipments/{consignmentNumber}/track', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'trackParcel',
            ]);
            Route::get('/delivery-choices', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'deliveryChoices',
            ]);
            Route::post('/book-pickup', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'bookPickup',
            ]);
            Route::get('/locations', [
                App\Http\Controllers\Api\V1\Admin\AdminShippingController::class,
                'locations',
            ]);
        });

        // Analytics & Production Reports (permission: reports)
        Route::prefix('reports')->middleware('permission:reports')->group(function () {
            Route::get('/', [App\Http\Controllers\Api\V1\Admin\AdminReportController::class, 'summary']);
            Route::get('/filter-options', [App\Http\Controllers\Api\V1\Admin\AdminReportController::class, 'filterOptions']);
        });

        // Staff & Permissions Management (Strictly Super Admin Only)
        Route::prefix('staff')->middleware('require.super_admin')->group(function () {
            Route::get('/presets', [StaffController::class, 'presets']);
            Route::post('/presets', [StaffController::class, 'storePreset']);
            Route::put('/presets/{id}', [StaffController::class, 'updatePreset'])->whereNumber('id');
            Route::delete('/presets/{id}', [StaffController::class, 'destroyPreset'])->whereNumber('id');

            Route::get('/audit-logs', [StaffController::class, 'auditLogs']);
            Route::get('/permissions-list', [StaffController::class, 'permissionsList']);
            Route::get('/', [StaffController::class, 'index']);
            Route::post('/', [StaffController::class, 'store']);
            Route::get('/{id}', [StaffController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [StaffController::class, 'update'])->whereNumber('id');
            Route::patch('/{id}/toggle-active', [StaffController::class, 'toggleActive'])->whereNumber('id');
            Route::delete('/{id}', [StaffController::class, 'destroy'])->whereNumber('id');
        });

        // Spin & Win Rewards Configuration & Ledger
        Route::prefix('spin-win')->group(function () {
            Route::get('/settings', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'getSettings']);
            Route::put('/settings', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'updateSettings']);
            Route::get('/ledger', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'getLedger']);
            Route::get('/categories', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'listCategories']);
            Route::post('/categories', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'storeCategory']);
            Route::put('/categories/{id}', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'updateCategory'])->whereNumber('id');
            Route::delete('/categories/{id}', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'deleteCategory'])->whereNumber('id');
            Route::delete('/rewards/{id}', [\App\Http\Controllers\Api\V1\Admin\AdminSpinRewardController::class, 'deleteReward'])->whereNumber('id');
        });
    });
Route::prefix('client-brief-auth')->group(function () {

    Route::post('/login', [
        ClientBriefAuthController::class,
        'login',
    ])->middleware('throttle:10,1');

});
Route::middleware([
    'auth:sanctum',
    'client.brief.admin',
])
    ->prefix('client-brief-auth')
    ->group(function () {

        Route::get('/me', [
            ClientBriefAuthController::class,
            'me',
        ]);

        Route::post('/logout', [
            ClientBriefAuthController::class,
            'logout',
        ]);
    });

// ==========================================
// CLIENT BRIEF ADMIN ROUTES
// ==========================================

Route::middleware([
    'auth:sanctum',
    'client.brief.admin',
])
    ->prefix('admin/client-briefs')
    ->group(function () {

        Route::get('/', [
            AdminClientBriefController::class,
            'index',
        ]);

        Route::post('/', [
            AdminClientBriefController::class,
            'store',
        ]);

        Route::get('/{id}', [
            AdminClientBriefController::class,
            'show',
        ])->whereNumber('id');

        Route::patch('/{id}', [
            AdminClientBriefController::class,
            'update',
        ])->whereNumber('id');
    });

