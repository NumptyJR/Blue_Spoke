<?php
declare(strict_types=1);
namespace Tests;
use PHPUnit\Framework\TestCase;
use App\Jwt;

final class JwtTest extends TestCase
{
    public function testIssueAndVerify(): void
    {
        [$token, $exp] = Jwt::issue(['sub' => 123, 'role' => 'owner']);
        $claims = Jwt::verify($token);

        $this->assertSame(123, $claims['sub']);
        $this->assertSame('owner', $claims['role']);
        $this->assertGreaterThan(time(), $claims['exp']);
    }
}
