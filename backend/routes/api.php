<?php

use App\Http\Controllers\Api\V1\Admin\DesignTemplates\DesignTemplateController;
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

// ==========================================
// PUBLIC ROUTES
// ==========================================

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

        Route::post('/logout', [AuthController::class, 'logout']);
    });

    Route::prefix('customers')->group(function () {
        Route::get('/profile', [CustomerController::class, 'profile']);

        Route::put('/profile', [CustomerController::class, 'updateProfile']);
    });

    Route::prefix('orders')->group(function () {
        Route::get('/', [
            App\Http\Controllers\Api\V1\Orders\OrderController::class,
            'index',
        ]);

        Route::get('/{orderNumber}', [
            App\Http\Controllers\Api\V1\Orders\OrderController::class,
            'show',
        ]);
    });

    Route::post('/checkout/process', [
        App\Http\Controllers\Api\V1\Checkout\CheckoutController::class,
        'process',
    ]);
});

// ==========================================
// AUTHENTICATED ADMIN ROUTES
// ==========================================

Route::middleware(['auth:sanctum'])
    ->prefix('admin')
    ->group(function () {

        // Categories
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

        // Products
        Route::get('/products', [
            App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
            'index',
        ]);

        Route::post('/products', [
            App\Http\Controllers\Api\V1\Admin\Products\ProductController::class,
            'store',
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

        // Design templates (admin creates and manages templates here)
        Route::get('/design-templates', [DesignTemplateController::class, 'index']);
        Route::post('/design-templates', [DesignTemplateController::class, 'store']);
        Route::get('/design-templates/{template}', [DesignTemplateController::class, 'show']);
        Route::match(['put', 'patch'], '/design-templates/{template}', [
            DesignTemplateController::class,
            'update',
        ]);
        Route::delete('/design-templates/{template}', [DesignTemplateController::class, 'destroy']);

        // Admin template APIs
        Route::get('/templates', [DesignTemplateController::class, 'index']);
        Route::post('/templates', [DesignTemplateController::class, 'store']);
        Route::get('/templates/{template}', [DesignTemplateController::class, 'show']);
        Route::match(['put', 'patch'], '/templates/{template}', [
            DesignTemplateController::class,
            'update',
        ]);
        Route::delete('/templates/{template}', [DesignTemplateController::class, 'destroy']);
        
        // Designer Assets (Admin Management)
        Route::apiResource('/designer/asset-categories', App\Http\Controllers\Api\V1\Admin\Designer\DesignAssetCategoryController::class);
        Route::apiResource('/designer/assets', App\Http\Controllers\Api\V1\Admin\Designer\DesignAssetController::class);

        Route::get('/metrics', [
            App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class,
            'metrics',
        ]);

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
