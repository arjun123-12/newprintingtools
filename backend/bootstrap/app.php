<?php

use App\Http\Middleware\ClientBriefAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('rewards:send-expiry-reminders')->dailyAt('09:00');
    })
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'client.brief.admin'  => ClientBriefAdmin::class,
            'admin.access'        => \App\Http\Middleware\AdminAccessMiddleware::class,
            'permission'          => \App\Http\Middleware\CheckAdminPermission::class,
            'require.super_admin' => \App\Http\Middleware\RequireSuperAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->create();
