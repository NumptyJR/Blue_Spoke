<?php

require __DIR__ . '/vendor/autoload.php';

use App\Config;

return [
    'paths' => [
        'migrations' => '%%PHINX_CONFIG_DIR%%/database/migrations',
        'seeds' => '%%PHINX_CONFIG_DIR%%/database/seeds'
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'development',
        'development' => [
            'adapter' => 'pgsql',
            'host' => Config::env('PGHOST', '127.0.0.1'),
            'name' => Config::env('PGDATABASE', 'postgres'),
            'user' => Config::env('PGUSER', 'postgres'),
            'pass' => Config::env('PGPASSWORD', ''),
            'port' => Config::env('PGPORT', '5432'),
            'charset' => 'utf8',
            'schema' => 'bike_shop'
        ]
    ],
    'version_order' => 'creation'
];
