<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use App\Controllers\AuthController;
use App\Http\Request;
use App\Database;

class AuthIntegrationTest extends TestCase
{
    private static $userId;
    private static $email;

    public static function setUpBeforeClass(): void
    {
        // Clean up test user if exists
        self::$email = 'test_' . time() . '@example.com';
        Database::pdo()->exec("DELETE FROM users WHERE email = '" . self::$email . "'");
    }

    public function testRegister()
    {
        $controller = new AuthController();
        $req = new Request();
        $req->body = [
            'email' => self::$email,
            'full_name' => 'Test User',
            'role' => 'mechanic',
            'password' => 'secret123'
        ];

        $res = $controller->register($req);
        $this->assertArrayHasKey('id', $res);
        self::$userId = $res['id'];
    }

    /**
     * @depends testRegister
     */
    public function testLogin()
    {
        $controller = new AuthController();
        $req = new Request();
        $req->body = [
            'email' => self::$email,
            'password' => 'secret123'
        ];

        $res = $controller->login($req);
        // Login returns [body, status] or body (if 200)
        // The controller returns array directly for 200, or [error, 401]

        if (isset($res[1]) && $res[1] === 401) {
            $this->fail('Login failed: ' . json_encode($res[0]));
        }

        $this->assertArrayHasKey('token', $res);
        $this->assertArrayHasKey('user', $res);
        $this->assertEquals(self::$email, $res['user']['email']);
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$userId) {
            Database::pdo()->exec("DELETE FROM users WHERE id = " . self::$userId);
        }
    }
}
