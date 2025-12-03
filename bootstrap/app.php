<?php
//Author: Joshua Schaff
//email: joshuarschaff@gmail.com
//Description: This file is the entry point for the application. It is responsible for loading the application and its dependencies.
use App\Router;
use App\Controllers\{
    AuthController,
    CustomerController,
    InventoryController,
    TimeClockController,
    WarrantyController,
    WorkOrderController,
    ScheduleController,
    UsersController,
    ServicesController
};
use App\Middleware\{Auth, RequireRole};

//Public
Router::get('/health', fn() => ['ok' => true, 'time' => date(DATE_ATOM)]);
Router::post('/auth/login', [AuthController::class, 'login']);
Router::post('/auth/refresh', [AuthController::class, 'refresh']);

// Authenticated routes
Router::group([Auth::class], function () {
    // Me
    Router::get('/me', [AuthController::class, 'me']);

    // Users (owner/manager)
    Router::post('/auth/register', [RequireRole::class, 'only:owner,manager'], [AuthController::class, 'register']);
    Router::post('/auth/set-password', [RequireRole::class, 'only:owner,manager'], [AuthController::class, 'setPassword']);

    // Customers
    Router::post('/customers', [RequireRole::class, 'only:owner,manager,sales,mechanic'], [CustomerController::class, 'create']);
    Router::get('/customers/{id}', [CustomerController::class, 'get']);
    Router::patch('/customers/{id}', [RequireRole::class, 'only:owner,manager,sales,mechanic'], [CustomerController::class, 'update']);
    Router::get('/customers', [CustomerController::class, 'list']);
    Router::get('/customers/{id}/bikes', [CustomerController::class, 'listBikes']);

    // Inventory
    Router::get('/inventory/items', [InventoryController::class, 'list']);
    Router::get('/inventory/brands', [InventoryController::class, 'listBrands']);
    Router::get('/inventory/categories', [InventoryController::class, 'listCategories']);
    Router::post('/inventory/items', [RequireRole::class, 'only:owner,manager'], [InventoryController::class, 'create']);
    Router::patch('/inventory/items/{id}', [RequireRole::class, 'only:owner,manager'], [InventoryController::class, 'update']);

    // Work Orders
    Router::post('/work-orders', [WorkOrderController::class, 'create']);
    Router::get('/work-orders/{id}', [WorkOrderController::class, 'get']);
    Router::post('/work-orders/{id}/parts', [WorkOrderController::class, 'addParts']);
    Router::post('/work-orders/{id}/services', [WorkOrderController::class, 'addServices']);
    Router::delete('/work-orders/{id}/parts/{lineId}', [WorkOrderController::class, 'deletePart']);
    Router::delete('/work-orders/{id}/services/{lineId}', [WorkOrderController::class, 'deleteService']);
    Router::patch('/work-orders/{id}/parts/{lineId}', [WorkOrderController::class, 'updatePartLine']);
    Router::patch('/work-orders/{id}/services/{lineId}', [WorkOrderController::class, 'updateServiceLine']);
    Router::patch('/work-orders/{id}/status', [WorkOrderController::class, 'updateStatus']);
    Router::patch('/work-orders/{id}', [WorkOrderController::class, 'update']);
    Router::get('/work-orders', [WorkOrderController::class, 'list']);

    // Scheduling
    Router::post('/work-orders/{id}/appointments', [ScheduleController::class, 'create']);
    Router::get('/schedule/next-slot', [ScheduleController::class, 'nextSlot']);
    Router::get('/work-orders/{id}/next-slot', [ScheduleController::class, 'nextSlotForWorkOrder']);
    Router::get('/schedule/mechanic', [ScheduleController::class, 'mechanicDay']);

    // Time clock
    Router::post('/time-clock/clock-in', [TimeClockController::class, 'clockIn']);
    Router::post('/time-clock/clock-out', [TimeClockController::class, 'clockOut']);
    Router::get('/time-clock/status', [TimeClockController::class, 'status']);

    // Warranty
    Router::post('/warranties', [RequireRole::class, 'only:owner,manager'], [WarrantyController::class, 'createTemplate']);
    Router::post('/customers/{id}/warranties', [WarrantyController::class, 'registerForCustomer']);
    Router::get('/customers/{id}/warranties', [WarrantyController::class, 'listForCustomer']);
    Router::get('/warranties', [WarrantyController::class, 'list']);
    Router::get('/warranties/templates', [WarrantyController::class, 'listTemplates']);
    Router::patch('/warranties/{id}', [WarrantyController::class, 'update']);

    // Users
    Router::get('/users', [UsersController::class, 'list']);

    // Services catalog
    Router::get('/services', [ServicesController::class, 'list']);
});
