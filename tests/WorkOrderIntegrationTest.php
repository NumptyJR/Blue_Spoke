<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Controllers\WorkOrderController;
use App\Http\Request;
use App\Database;

class WorkOrderIntegrationTest extends TestCase
{
    private static $customerId;
    private static $itemId;
    private static $serviceId;
    private static $woId;
    private static $locationId;

    public static function setUpBeforeClass(): void
    {
        $pdo = Database::pdo();

        // Clean up any leftovers from previous failed runs
        $pdo->exec("DELETE FROM inventory_items WHERE sku = 'TEST-SKU'");
        $pdo->exec("DELETE FROM customers WHERE email = 'test@example.com'");
        $pdo->exec("DELETE FROM services_catalog WHERE code = 'TEST-SVC'");

        // Create test customer
        $stmt = $pdo->prepare("INSERT INTO customers (first_name, last_name, email) VALUES ('Test', 'Customer', 'test@example.com') RETURNING id");
        $stmt->execute();
        self::$customerId = $stmt->fetchColumn();

        // Create test inventory item
        $stmt = $pdo->prepare("INSERT INTO brands (name) VALUES ('TestBrand') ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id");
        $stmt->execute();
        $brandId = $stmt->fetchColumn();

        $stmt = $pdo->prepare("INSERT INTO inventory_items (sku, name, brand_id, price, cost) VALUES ('TEST-SKU', 'Test Item', :bid, 10.00, 5.00) RETURNING id");
        $stmt->execute([':bid' => $brandId]);
        self::$itemId = $stmt->fetchColumn();

        // Stock the item
        $stmt = $pdo->prepare("INSERT INTO locations (name) VALUES ('TestLoc') ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id");
        $stmt->execute();
        self::$locationId = $stmt->fetchColumn();

        $pdo->prepare("INSERT INTO inventory_stock (location_id, item_id, quantity_on_hand) VALUES (?, ?, 100)")->execute([self::$locationId, self::$itemId]);

        // Create test service
        $stmt = $pdo->prepare("INSERT INTO services_catalog (code, name, default_price, default_minutes) VALUES ('TEST-SVC', 'Test Service', 20.00, 30) RETURNING id");
        $stmt->execute();
        self::$serviceId = $stmt->fetchColumn();
    }

    public function testCreateWorkOrder()
    {
        $controller = new WorkOrderController();
        $req = new Request();
        $req->body = [
            'customer_id' => self::$customerId,
            'location_id' => self::$locationId,
            'status' => 'open',
            'bike' => [
                'brand' => 'Trek',
                'model' => 'Domane',
                'color' => 'Red'
            ]
        ];
        // Mock user
        $req->user = ['id' => 1];

        $res = $controller->create($req);
        $this->assertArrayHasKey('id', $res);
        self::$woId = $res['id'];
    }

    /**
     * @depends testCreateWorkOrder
     */
    public function testAddParts()
    {
        $controller = new WorkOrderController();
        $req = new Request();
        $req->body = [
            'items' => [
                ['item_id' => self::$itemId, 'quantity' => 2]
            ]
        ];

        $res = $controller->addParts($req, self::$woId);
        $this->assertArrayHasKey('ok', $res);
        $this->assertTrue($res['ok']);
    }

    /**
     * @depends testCreateWorkOrder
     */
    public function testAddServices()
    {
        $controller = new WorkOrderController();
        $req = new Request();
        $req->body = [
            'items' => [
                ['service_id' => self::$serviceId, 'quantity' => 1]
            ]
        ];

        $res = $controller->addServices($req, self::$woId);
        $this->assertArrayHasKey('ok', $res);
        $this->assertTrue($res['ok']);
    }

    /**
     * @depends testAddParts
     * @depends testAddServices
     */
    public function testGetWorkOrder()
    {
        $controller = new WorkOrderController();
        $req = new Request();

        $res = $controller->get($req, self::$woId);

        $this->assertArrayHasKey('work_order', $res);
        $this->assertEquals(self::$woId, $res['work_order']['id']);

        $this->assertCount(1, $res['parts']);
        $this->assertEquals(2, $res['parts'][0]['quantity']);

        $this->assertCount(1, $res['services']);

        // Check totals: (2 * 10.00) + (1 * 20.00) = 40.00
        $this->assertEquals(40.00, $res['totals']['total']);
    }

    public static function tearDownAfterClass(): void
    {
        $pdo = Database::pdo();
        if (self::$woId)
            $pdo->exec("DELETE FROM work_orders WHERE id = " . self::$woId);
        if (self::$customerId)
            $pdo->exec("DELETE FROM customers WHERE id = " . self::$customerId);
        if (self::$itemId)
            $pdo->exec("DELETE FROM inventory_items WHERE id = " . self::$itemId);
        if (self::$serviceId)
            $pdo->exec("DELETE FROM services_catalog WHERE id = " . self::$serviceId);
    }
}
