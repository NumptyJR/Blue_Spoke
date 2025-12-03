<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: UsersController.php
// Description: Users controller

namespace App\Controllers;

use App\Http\Request;
use App\Database;

final class UsersController
{
    public function list(Request $req): array
    {
        $pdo = Database::pdo();
        $role = $req->query['role'] ?? null;
        $sql = 'SELECT id, full_name, role FROM users WHERE is_active = TRUE';
        $p = [];
        if ($role) {
            $sql .= ' AND role = ?';
            $p[] = $role;
        }
        $sql .= ' ORDER BY full_name';
        $st = $pdo->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll()];
    }
}

