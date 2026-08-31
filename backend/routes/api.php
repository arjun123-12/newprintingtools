<?php

use App\Http\Controllers\Api\V1\Designer\DesignerController;
use App\Http\Controllers\Api\V1\Artwork\ArtworkController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes
|--------------------------------------------------------------------------
|
| Base URI: /api/v1/
| All responses are strictly JSON formatted.
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

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Catalog & Dynamic Pricing
Route::prefix('products')->group(function () {
    Route::get('/', [App\Http\Controllers\Api\V1\Admin\Products\ProductController::class, 'index']);
    Route::get('/{id}', [App\Http\Controllers\Api\V1\Admin\Products\ProductController::class, 'show']);
});

Route::prefix('categories')->group(function () {
    Route::get('/', [App\Http\Controllers\Api\V1\Categories\CategoryController::class, 'index']);
    Route::get('/{slug}', [App\Http\Controllers\Api\V1\Categories\CategoryController::class, 'show']);
});

Route::post('/pricing/calculate', [App\Http\Controllers\Api\V1\Pricing\PricingController::class, 'calculate']);

// Customers/designers can load active templates belonging to one product.
Route::get('/designer/templates/{productId?}', [
    DesignerController::class,
    'templates',
]);

Route::get('/templates', [
    DesignerController::class,
    'templates',
]);

// CORS-safe storage file access and secure proxy for canvas export & 3D preview
Route::get('/designer/proxy-image', [
    DesignerController::class,
    'proxyImage',
]);

Route::get('/storage/{path}', [
    DesignerController::class,
    'serveStorage',
])->where('path', '.*');

// TEMPORARY LOCAL TEST ROUTE.
// Move this route into the authenticated admin group before deployment.
Route::post('/designer/templates/{productId}', [
    DesignerController::class,
    'storeTemplate',
]);

// Authentication
Route::prefix('auth')->group(function () {
    Route::post('/login', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'login']);
    Route::post('/register', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'register']);
});

// Artwork Pre-flight & Upload Presigning
// Route::post('/artwork/presign-upload', [App\Http\Controllers\Api\V1\Artwork\ArtworkController::class, 'presign']);
// Route::post('/artwork/verify', [App\Http\Controllers\Api\V1\Artwork\ArtworkController::class, 'verify']);

// Guest Cart
Route::prefix('cart')->group(function () {
    Route::get('/', [App\Http\Controllers\Api\V1\Cart\CartController::class, 'getCart']);
    Route::post('/items', [App\Http\Controllers\Api\V1\Cart\CartController::class, 'addItem']);
    Route::put('/items/{itemId}', [App\Http\Controllers\Api\V1\Cart\CartController::class, 'updateItem']);
    Route::delete('/items/{itemId}', [App\Http\Controllers\Api\V1\Cart\CartController::class, 'removeItem']);
});

// ==========================================
// AUTHENTICATED CUSTOMER ROUTES (Sanctum)
// ==========================================
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('/me', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'me']);
        Route::post('/logout', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'logout']);
    });

    Route::prefix('customers')->group(function () {
        Route::get('/profile', [App\Http\Controllers\Api\V1\Customers\CustomerController::class, 'profile']);
        Route::put('/profile', [App\Http\Controllers\Api\V1\Customers\CustomerController::class, 'updateProfile']);
    });

    Route::prefix('orders')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\V1\Orders\OrderController::class, 'index']);
        Route::get('/{orderNumber}', [App\Http\Controllers\Api\V1\Orders\OrderController::class, 'show']);
    });

    Route::post('/checkout/process', [App\Http\Controllers\Api\V1\Checkout\CheckoutController::class, 'process']);


    Route::prefix('artworks')->group(function () {
    Route::get('/', [ArtworkController::class, 'index']);
    Route::post('/', [ArtworkController::class, 'store']);

    Route::post('/presign-upload', [
        ArtworkController::class,
        'presign',
    ]);

    Route::post('/verify', [
        ArtworkController::class,
        'verify',
    ]);

    Route::get('/{artwork}', [
        ArtworkController::class,
        'show',
    ]);

    Route::put('/{artwork}', [
        ArtworkController::class,
        'update',
    ]);

    Route::post('/{artwork}/complete', [
        ArtworkController::class,
        'complete',
    ]);

    Route::delete('/{artwork}', [
        ArtworkController::class,
        'destroy',
    ]);
});
});

// ==========================================
// ADMIN & STAFF ROUTES (Sanctum + RBAC)
// ==========================================
Route::middleware(['auth:sanctum'])
    ->prefix('admin')
    ->group(function () {
        Route::get('/metrics', [
            App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class,
            'metrics',
        ]);

        // Temporarily disabled because the public test route is below.
        // Route::post('/products', [
        //     App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
        //     'store',
        // ]);

        Route::post('/products/{id}/images', [
            App\Http\Controllers\Api\V1\Admin\ProductImages\ProductImageController::class,
            'store',
        ]);

        Route::apiResource(
            'products.variants',
            App\Http\Controllers\Api\V1\Admin\ProductVariants\ProductVariantController::class
        );

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

        Route::get('/artwork-queue', [
            App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class,
            'queue',
        ]);
    });

// ==========================================
// TEMPORARY LOCAL ADMIN TEST ROUTES
// Protect these with auth:sanctum before deployment.
// ==========================================

Route::get('/admin/templates', [
    DesignerController::class,
    'indexTemplates',
]);

Route::get('/admin/templates/{id}', [
    DesignerController::class,
    'showTemplate',
]);

Route::post('/admin/templates', [
    DesignerController::class,
    'storeAdminTemplate',
]);

Route::patch('/admin/templates/{id}', [
    DesignerController::class,
    'updateTemplate',
]);

Route::delete('/admin/templates/{id}', [
    DesignerController::class,
    'destroyTemplate',
]);


Route::get('/admin/categories', [
    App\Http\Controllers\Api\V1\Categories\CategoryController::class,
    'adminIndex',
]);

Route::post('/admin/categories', [
    App\Http\Controllers\Api\V1\Categories\CategoryController::class,
    'store',
]);

Route::patch('/admin/categories/{id}', [
    App\Http\Controllers\Api\V1\Categories\CategoryController::class,
    'update',
]);

Route::delete('/admin/categories/{id}', [
    App\Http\Controllers\Api\V1\Categories\CategoryController::class,
    'destroy',
]);

Route::get('/admin/products', [
    App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
    'index',
]);

Route::post('/admin/products', [
    App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
    'store',
]);

Route::get('/admin/products/{id}', [
    App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
    'show',
]);

Route::patch('/admin/products/{id}', [
    App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
    'update',
]);

Route::delete('/admin/products/{id}', [
    App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
    'destroy',
]);

Route::post('/admin/products/{id}/images', [
    App\Http\Controllers\Api\V1\Admin\ProductImages\ProductImageController::class,
    'store',
]);


