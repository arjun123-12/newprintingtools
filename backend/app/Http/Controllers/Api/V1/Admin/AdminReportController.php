<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminReportController extends Controller
{
    /**
     * Generate aggregated analytics and production reports.
     * Enforces permission checks and masks financial figures for non-financial staff.
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Permission Check: Financial authorization
        $canViewFinancials = $user->isSuperAdmin()
            || $user->hasPermission('pricing')
            || $user->hasPermission('invoices')
            || $user->hasPermission('orders');

        // 2. Validate and Parse Filters
        $validated = $request->validate([
            'period' => 'nullable|string|in:today,7d,30d,90d,12m,custom',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'product_id' => 'nullable|uuid|exists:products,id',
            'category_id' => 'nullable|uuid|exists:categories,id',
            'order_status' => 'nullable|string',
        ]);

        $period = $validated['period'] ?? '30d';
        [$startDate, $endDate] = $this->resolveDateRange(
            $period,
            $validated['start_date'] ?? null,
            $validated['end_date'] ?? null
        );

        $productId = $validated['product_id'] ?? null;
        $categoryId = $validated['category_id'] ?? null;
        $orderStatus = $validated['order_status'] ?? null;

        // 3. Base Orders Query for the Filter Period
        $ordersQuery = Order::query()
            ->whereBetween('created_at', [$startDate, $endDate]);

        if (!empty($orderStatus) && $orderStatus !== 'all') {
            $ordersQuery->where('status', $orderStatus);
        }

        if (!empty($productId)) {
            $ordersQuery->whereHas('items', function ($q) use ($productId) {
                $q->where('product_id', $productId);
            });
        } elseif (!empty($categoryId)) {
            $ordersQuery->whereHas('items.product', function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            });
        }

        // 4. Overall KPIs
        $matchingOrdersCount = (clone $ordersQuery)->count();
        $totalRevenue = 0.00;
        $averageOrderValue = 0.00;

        if ($canViewFinancials) {
            $totalRevenue = (float) ((clone $ordersQuery)->sum('total_inc_gst'));
            $averageOrderValue = $matchingOrdersCount > 0 ? round($totalRevenue / $matchingOrdersCount, 2) : 0.00;
        }

        // Matching Order IDs for downstream item/material aggregations
        $matchingOrderIds = (clone $ordersQuery)->pluck('id');

        // 5. Production Job Metrics
        $itemsQuery = OrderItem::query()->whereIn('order_id', $matchingOrderIds);
        if (!empty($productId)) {
            $itemsQuery->where('product_id', $productId);
        } elseif (!empty($categoryId)) {
            $itemsQuery->whereHas('product', fn($q) => $q->where('category_id', $categoryId));
        }

        $totalUnitsPrinted = (int) (clone $itemsQuery)->sum('quantity');
        $inProductionCount = (int) (clone $itemsQuery)
            ->whereIn('production_status', ['queued', 'prepress', 'printing', 'finishing', 'packaging'])
            ->count();
        $completedJobsCount = (int) (clone $itemsQuery)
            ->where('production_status', 'completed')
            ->count();

        // 6. Revenue & Orders Over Time
        $timelineData = $this->buildTimelineData(
            $matchingOrderIds,
            $startDate,
            $endDate,
            $period,
            $canViewFinancials
        );

        // 7. Top Products Breakdown
        $topProducts = $this->buildTopProducts(
            $matchingOrderIds,
            $productId,
            $categoryId,
            $canViewFinancials
        );

        // 8. Materials Usage Breakdown (from actual stored options_snapshot)
        $materialsUsage = $this->buildMaterialsUsage(
            $matchingOrderIds,
            $productId,
            $categoryId
        );

        // 9. Turnaround Metrics (from order, artwork, and shipment timestamps)
        $turnaround = $this->buildTurnaroundMetrics($matchingOrderIds);

        return response()->json([
            'success' => true,
            'can_view_financials' => $canViewFinancials,
            'filters' => [
                'period' => $period,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'product_id' => $productId,
                'category_id' => $categoryId,
                'order_status' => $orderStatus ?: 'all',
            ],
            'kpis' => [
                'total_orders' => $matchingOrdersCount,
                'total_revenue' => $canViewFinancials ? $totalRevenue : null,
                'average_order_value' => $canViewFinancials ? $averageOrderValue : null,
                'total_units_printed' => $totalUnitsPrinted,
                'in_production_jobs' => $inProductionCount,
                'completed_jobs' => $completedJobsCount,
                'currency' => 'AUD',
            ],
            'timeline' => $timelineData,
            'top_products' => $topProducts,
            'materials_usage' => $materialsUsage,
            'turnaround' => $turnaround,
        ]);
    }

    /**
     * Provide filter dropdown options (categories and products).
     */
    public function filterOptions(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->select(['id', 'name', 'slug'])
            ->orderBy('name')
            ->get();

        $products = Product::query()
            ->where('is_active', true)
            ->select(['id', 'name', 'sku', 'category_id'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'categories' => $categories,
                'products' => $products,
            ],
        ]);
    }

    /**
     * Parse date range from period or explicit dates.
     */
    protected function resolveDateRange(string $period, ?string $start, ?string $end): array
    {
        $now = Carbon::now();

        switch ($period) {
            case 'today':
                return [Carbon::today()->startOfDay(), $now];
            case '7d':
                return [$now->copy()->subDays(7)->startOfDay(), $now];
            case '90d':
                return [$now->copy()->subDays(90)->startOfDay(), $now];
            case '12m':
                return [$now->copy()->subMonths(12)->startOfDay(), $now];
            case 'custom':
                if (!empty($start) && !empty($end)) {
                    return [
                        Carbon::parse($start)->startOfDay(),
                        Carbon::parse($end)->endOfDay(),
                    ];
                }
                return [$now->copy()->subDays(30)->startOfDay(), $now];
            case '30d':
            default:
                return [$now->copy()->subDays(30)->startOfDay(), $now];
        }
    }

    /**
     * Build daily or monthly aggregated timeline series.
     */
    protected function buildTimelineData($matchingOrderIds, Carbon $startDate, Carbon $endDate, string $period, bool $canViewFinancials): array
    {
        $isMonthly = $period === '12m' || $startDate->diffInDays($endDate) > 90;

        if ($matchingOrderIds->isEmpty()) {
            return [];
        }

        // Query grouped results from DB
        $groupByFormat = $isMonthly ? '%Y-%m' : '%Y-%m-%d';
        $phpFormat = $isMonthly ? 'Y-m' : 'Y-m-d';
        $displayFormat = $isMonthly ? 'M Y' : 'd M';

        $rawResults = DB::table('orders')
            ->whereIn('id', $matchingOrderIds)
            ->selectRaw("
                DATE_FORMAT(created_at, '{$groupByFormat}') as period_key,
                COUNT(*) as orders_count,
                SUM(total_inc_gst) as revenue_sum
            ")
            ->groupBy('period_key')
            ->orderBy('period_key')
            ->get()
            ->keyBy('period_key');

        // Generate full chronological date buckets so line charts don't have gaps
        $timeline = [];
        if ($isMonthly) {
            $current = $startDate->copy()->startOfMonth();
            $endLimit = $endDate->copy()->startOfMonth();
            while ($current->lte($endLimit)) {
                $key = $current->format($phpFormat);
                $found = $rawResults->get($key);
                $timeline[] = [
                    'key' => $key,
                    'label' => $current->format($displayFormat),
                    'orders' => $found ? (int) $found->orders_count : 0,
                    'revenue' => ($canViewFinancials && $found) ? (float) $found->revenue_sum : 0.00,
                ];
                $current->addMonth();
            }
        } else {
            $periodDays = CarbonPeriod::create($startDate->copy()->startOfDay(), '1 day', $endDate->copy()->startOfDay());
            foreach ($periodDays as $day) {
                $key = $day->format($phpFormat);
                $found = $rawResults->get($key);
                $timeline[] = [
                    'key' => $key,
                    'label' => $day->format($displayFormat),
                    'orders' => $found ? (int) $found->orders_count : 0,
                    'revenue' => ($canViewFinancials && $found) ? (float) $found->revenue_sum : 0.00,
                ];
            }
        }

        return $timeline;
    }

    /**
     * Build top products aggregation table.
     */
    protected function buildTopProducts($matchingOrderIds, ?string $productId, ?string $categoryId, bool $canViewFinancials): array
    {
        if ($matchingOrderIds->isEmpty()) {
            return [];
        }

        $query = OrderItem::query()
            ->whereIn('order_id', $matchingOrderIds)
            ->select('product_id', 'product_name', 'product_sku')
            ->selectRaw('COUNT(DISTINCT order_id) as orders_count')
            ->selectRaw('SUM(quantity) as total_units')
            ->selectRaw('SUM(total_price_inc_gst) as total_revenue')
            ->groupBy('product_id', 'product_name', 'product_sku');

        if (!empty($productId)) {
            $query->where('product_id', $productId);
        } elseif (!empty($categoryId)) {
            $query->whereHas('product', fn($q) => $q->where('category_id', $categoryId));
        }

        $items = $query->orderByDesc('total_units')->limit(10)->get();
        $grandTotalUnits = $items->sum('total_units') ?: 1;

        return $items->map(function ($item) use ($grandTotalUnits, $canViewFinancials) {
            return [
                'product_id' => $item->product_id,
                'name' => $item->product_name,
                'sku' => $item->product_sku ?: '–',
                'orders_count' => (int) $item->orders_count,
                'total_units' => (int) $item->total_units,
                'volume_share_pct' => round(((int) $item->total_units / $grandTotalUnits) * 100, 1),
                'revenue' => $canViewFinancials ? (float) $item->total_revenue : null,
            ];
        })->values()->all();
    }

    /**
     * Build materials usage aggregation based on actual stored options_snapshot attributes.
     */
    protected function buildMaterialsUsage($matchingOrderIds, ?string $productId, ?string $categoryId): array
    {
        if ($matchingOrderIds->isEmpty()) {
            return [
                'has_data' => false,
                'stocks' => [],
                'finishes' => [],
            ];
        }

        $query = OrderItem::query()
            ->whereIn('order_id', $matchingOrderIds)
            ->select(['id', 'product_id', 'quantity', 'options_snapshot']);

        if (!empty($productId)) {
            $query->where('product_id', $productId);
        } elseif (!empty($categoryId)) {
            $query->whereHas('product', fn($q) => $q->where('category_id', $categoryId));
        }

        $items = $query->get();

        $stockCounts = [];
        $finishCounts = [];

        foreach ($items as $item) {
            $options = $item->options_snapshot;
            if (!is_array($options) || empty($options)) {
                continue;
            }

            // Extract Paper Stock / Substrate
            $stockVal = $options['stock']
                ?? $options['paper_stock']
                ?? $options['material']
                ?? $options['substrate']
                ?? null;

            if ($stockVal && is_string($stockVal)) {
                $stockCounts[$stockVal] = ($stockCounts[$stockVal] ?? 0) + (int) $item->quantity;
            }

            // Extract Coating / Finish
            $finishVal = $options['finish']
                ?? $options['coating']
                ?? $options['lamination']
                ?? null;

            if ($finishVal && is_string($finishVal)) {
                $finishCounts[$finishVal] = ($finishCounts[$finishVal] ?? 0) + (int) $item->quantity;
            }
        }

        $totalStockUnits = array_sum($stockCounts);
        $totalFinishUnits = array_sum($finishCounts);

        $stocksFormatted = collect($stockCounts)
            ->map(fn($qty, $name) => [
                'name' => $name,
                'units' => $qty,
                'share_pct' => $totalStockUnits > 0 ? round(($qty / $totalStockUnits) * 100, 1) : 0,
            ])
            ->sortByDesc('units')
            ->values()
            ->all();

        $finishesFormatted = collect($finishCounts)
            ->map(fn($qty, $name) => [
                'name' => $name,
                'units' => $qty,
                'share_pct' => $totalFinishUnits > 0 ? round(($qty / $totalFinishUnits) * 100, 1) : 0,
            ])
            ->sortByDesc('units')
            ->values()
            ->all();

        $hasData = !empty($stocksFormatted) || !empty($finishesFormatted);

        return [
            'has_data' => $hasData,
            'total_stock_units' => $totalStockUnits,
            'total_finish_units' => $totalFinishUnits,
            'stocks' => $stocksFormatted,
            'finishes' => $finishesFormatted,
        ];
    }

    /**
     * Compute turnaround metrics from real order, artwork, and shipment timestamps.
     */
    protected function buildTurnaroundMetrics($matchingOrderIds): array
    {
        if ($matchingOrderIds->isEmpty()) {
            return [
                'has_data' => false,
                'sample_size' => 0,
                'avg_artwork_approval_hours' => null,
                'avg_production_dispatch_hours' => null,
                'avg_total_fulfillment_days' => null,
                'distribution' => [
                    'under_24h' => 0,
                    'one_to_three_days' => 0,
                    'three_to_five_days' => 0,
                    'over_five_days' => 0,
                ],
            ];
        }

        $orders = Order::query()
            ->whereIn('id', $matchingOrderIds)
            ->with([
                'items.artwork',
                'latestShipment',
            ])
            ->get();

        $approvalHoursList = [];
        $dispatchHoursList = [];
        $totalDaysList = [];

        $distUnder24h = 0;
        $dist1to3d = 0;
        $dist3to5d = 0;
        $distOver5d = 0;

        foreach ($orders as $order) {
            $orderCreated = $order->created_at;

            // 1. Artwork Approval Duration
            $artwork = $order->items->first()?->artwork;
            if ($artwork && $artwork->approved_at) {
                $hoursToApprove = abs($orderCreated->diffInHours($artwork->approved_at));
                $approvalHoursList[] = $hoursToApprove;
            }

            // 2. Production to Dispatch Duration
            $shipment = $order->latestShipment;
            $shippedAt = $shipment?->shipped_at
                ?? ($order->status->value === 'dispatched' || $order->status->value === 'delivered' ? $order->updated_at : null);

            if ($shippedAt) {
                $productionStart = $artwork?->approved_at ?? $orderCreated;
                $hoursToDispatch = abs($productionStart->diffInHours($shippedAt));
                $dispatchHoursList[] = $hoursToDispatch;

                // Total Fulfillment Time
                $totalFulfillmentDays = round(abs($orderCreated->diffInHours($shippedAt)) / 24, 1);
                $totalDaysList[] = $totalFulfillmentDays;

                if ($totalFulfillmentDays < 1.0) {
                    $distUnder24h++;
                } elseif ($totalFulfillmentDays <= 3.0) {
                    $dist1to3d++;
                } elseif ($totalFulfillmentDays <= 5.0) {
                    $dist3to5d++;
                } else {
                    $distOver5d++;
                }
            }
        }

        $sampleSize = count($totalDaysList);
        $hasData = $sampleSize > 0 || count($approvalHoursList) > 0;

        return [
            'has_data' => $hasData,
            'sample_size' => $sampleSize,
            'avg_artwork_approval_hours' => count($approvalHoursList) > 0 ? round(array_sum($approvalHoursList) / count($approvalHoursList), 1) : null,
            'avg_production_dispatch_hours' => count($dispatchHoursList) > 0 ? round(array_sum($dispatchHoursList) / count($dispatchHoursList), 1) : null,
            'avg_total_fulfillment_days' => $sampleSize > 0 ? round(array_sum($totalDaysList) / $sampleSize, 1) : null,
            'distribution' => [
                'under_24h' => $distUnder24h,
                'one_to_three_days' => $dist1to3d,
                'three_to_five_days' => $dist3to5d,
                'over_five_days' => $distOver5d,
            ],
        ];
    }
}
