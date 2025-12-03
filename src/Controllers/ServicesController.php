<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: ServicesController.php
// Description: Services controller

namespace App\Controllers;
use App\Http\Request;
use App\Database;

final class ServicesController
{
    public function list(Request $req): array
    {
        $pdo = Database::pdo();
        $q = trim((string) ($req->query['q'] ?? ''));
        $sql = 'SELECT id, code, name, default_minutes, default_price FROM services_catalog';
        $p = [];
        if ($q !== '') {
            $sql .= ' WHERE code ILIKE ? OR name ILIKE ?';
            $p = ["%$q%", "%$q%"];
        }
        $sql .= ' ORDER BY name LIMIT 50';
        $st = $pdo->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll()];
    }
}

