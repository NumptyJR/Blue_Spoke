<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: Router.php
// Description: Router class

namespace App;
use Closure;
use App\Http\{Request, Response};

final class Router
{
    private static array $routes = [];

    public static function get(string $path, ...$handlers): void
    {
        self::add('GET', $path, $handlers);
    }
    public static function post(string $path, ...$handlers): void
    {
        self::add('POST', $path, $handlers);
    }
    public static function put(string $path, ...$handlers): void
    {
        self::add('PUT', $path, $handlers);
    }
    public static function patch(string $path, ...$handlers): void
    {
        self::add('PATCH', $path, $handlers);
    }
    public static function delete(string $path, ...$handlers): void
    {
        self::add('DELETE', $path, $handlers);
    }


    public static function group(array $middlewares, callable $define): void
    {
        $prev = self::$routes;
        $define();
        $new = array_slice(self::$routes, count($prev));
        // Ensure group middlewares wrap route-specific ones
        // so Auth executes first. Prepend group-level middlewares.
        foreach ($new as &$r) {
            $r['middlewares'] = array_merge($middlewares, $r['middlewares']);
        }
        self::$routes = array_merge($prev, $new);
    }

    private static function add(string $method, string $path, array $handlers): void
    {
        $callable = array_pop($handlers);
        $middlewares = $handlers; // any preceding items are middlewares
        self::$routes[] = compact('method', 'path', 'callable') + ['middlewares' => $middlewares];
    }

    public static function dispatch(): void
    {
        $req = new Request();
        foreach (self::$routes as $r) {
            if ($r['method'] !== $req->method)
                continue;
            $params = [];
            if (self::match($r['path'], $req->path, $params)) {
                $handler = $r['callable'];
                $next = function () use ($handler, $req, $params) {
                    $result = is_array($handler) ? (new $handler[0])->{$handler[1]}($req, ...$params)
                        : $handler($req, ...$params);
                    Response::json($result[0] ?? $result, $result[1] ?? 200);
                };
                $chain = $next;
                foreach (array_reverse($r['middlewares']) as $mw) {
                    $chain = self::wrapMiddleware($mw, $chain, $req);
                }
                $chain();
                return;
            }
        }
        Response::json(['error' => 'Not found'], 404);
    }
    private static function wrapMiddleware($mw, $next, Request $req): Closure
    {
        if (is_string($mw)) {
            return function () use ($mw, $next, $req) {
                (new $mw)->handle($req, $next); };
        }
        if (is_array($mw)) {
            [$cls, $arg] = $mw;
            return function () use ($cls, $arg, $next, $req) {
                (new $cls)->handle($req, $next, $arg); };
        }
        return function () use ($mw, $next, $req) {
            $mw($req, $next); };
    }


    private static function match(string $route, string $path, array &$outParams): bool
    {
        $rSeg = array_values(array_filter(explode('/', trim($route, '/'))));
        $pSeg = array_values(array_filter(explode('/', trim($path, '/'))));
        if (count($rSeg) !== count($pSeg))
            return false;
        foreach ($rSeg as $i => $seg) {
            if (preg_match('/^{(\w+)}$/', $seg, $m)) {
                $outParams[] = $pSeg[$i];
            } elseif ($seg !== $pSeg[$i]) {
                return false;
            }
        }
        return true;
    }
}
