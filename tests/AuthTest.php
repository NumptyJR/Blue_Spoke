<?php
declare(strict_types=1);
namespace Tests;
use PHPUnit\Framework\TestCase;
use App\Config;

final class AuthTest extends TestCase
{
    public function testEnvLoads(): void
    {
        $this->assertNotEmpty(Config::env('JWT_SECRET', 'x'));
    }
}