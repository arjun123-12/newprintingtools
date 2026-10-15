<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    public function metrics(Request $request): JsonResponse
    {
        $user = $request->user();
        $canViewFinancials = $user && ($user->isSuperAdmin()
            || $user->hasPermission('pricing')
            || $user->hasPermission('invoices')
            || $user->hasPermission('orders'));

        $totalOrders = Order::count();
        $revenueAud = $canViewFinancials ? (float) Order::sum('total_inc_gst') : null;
        $pendingArtworkReviews = Artwork::where('review_status', 'pending_review')->count();
        $inProduction = OrderItem::whereIn('production_status', ['queued', 'prepress', 'printing', 'finishing'])->count();

        return response()->json([
            'success' => true,
            'can_view_financials' => $canViewFinancials,
            'data' => [
                'total_orders' => $totalOrders,
                'revenue_aud' => $revenueAud,
                'pending_artwork_reviews' => $pendingArtworkReviews,
                'in_production' => $inProduction,
            ],
        ]);
    }
}
