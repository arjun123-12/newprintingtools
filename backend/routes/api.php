<?php

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
    Route::get('/', [App\Http\Controllers\Api\V1\Products\ProductController::class, 'index']);
    Route::get('/{slug}', [App\Http\Controllers\Api\V1\Products\ProductController::class, 'show']);
});

Route::prefix('categories')->group(function () {
    Route::get('/', [App\Http\Controllers\Api\V1\Categories\CategoryController::class, 'index']);
    Route::get('/{slug}', [App\Http\Controllers\Api\V1\Categories\CategoryController::class, 'show']);
});

Route::post('/pricing/calculate', [App\Http\Controllers\Api\V1\Pricing\PricingController::class, 'calculate']);
Route::get('/designer/templates/{productId}', [App\Http\Controllers\Api\V1\Designer\DesignerController::class, 'templates']);

// Authentication
Route::prefix('auth')->group(function () {
    Route::post('/login', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'login']);
    Route::post('/register', [App\Http\Controllers\Api\V1\Auth\AuthController::class, 'register']);
});

// Artwork Pre-flight & Upload Presigning
Route::post('/artwork/presign-upload', [App\Http\Controllers\Api\V1\Artwork\ArtworkController::class, 'presign']);
Route::post('/artwork/verify', [App\Http\Controllers\Api\V1\Artwork\ArtworkController::class, 'verify']);

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
});

// ==========================================
// ADMIN & STAFF ROUTES (Sanctum + RBAC)
// ==========================================
Route::middleware(['auth:sanctum'])->prefix('admin')->group(function () {
    Route::get('/metrics', [App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'metrics']);
    Route::get('/products', [App\Http\Controllers\Api\V1\Admin\AdminProductController::class, 'index']);
    Route::post('/products', [App\Http\Controllers\Api\V1\Admin\AdminProductController::class, 'store']);
    Route::get('/orders', [App\Http\Controllers\Api\V1\Admin\AdminOrderController::class, 'index']);
    Route::get('/orders/{id}', [App\Http\Controllers\Api\V1\Admin\AdminOrderController::class, 'show']);
    Route::patch('/orders/{id}/status', [App\Http\Controllers\Api\V1\Admin\AdminOrderController::class, 'updateStatus']);
    Route::get('/artwork-queue', [App\Http\Controllers\Api\V1\Admin\AdminArtworkController::class, 'queue']);
});
