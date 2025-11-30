<?php
namespace App\Controllers;
use App\Http\Request;
use App\Database;

final class CustomerController
{
    public function create(Request $req): array
    {
        $b = $req->body;
        $stmt = Database::pdo()->prepare('INSERT INTO customers (first_name,last_name,email,phone,street,city,region,postal_code,country,notes)
            VALUES (:first_name,:last_name,:email,:phone,:street,:city,:region,:postal_code,:country,:notes) RETURNING id');
        $stmt->execute([
            ':first_name' => $b['first_name'] ?? '',
            ':last_name' => $b['last_name'] ?? '',
            ':email' => $b['email'] ?? null,
            ':phone' => $b['phone'] ?? null,
            ':street' => $b['street'] ?? null,
            ':city' => $b['city'] ?? null,
            ':region' => $b['region'] ?? null,
            ':postal_code' => $b['postal_code'] ?? null,
            ':country' => $b['country'] ?? null,
            ':notes' => $b['notes'] ?? null,
        ]);
        return ['id' => (int) $stmt->fetchColumn()];
    }

    public function update(Request $req, $id): array
    {
        $b = $req->body;
        $fields = [];
        $params = [':id' => (int) $id];

        $allowed = ['first_name', 'last_name', 'email', 'phone', 'street', 'city', 'region', 'postal_code', 'country', 'notes'];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $b)) {
                $fields[] = "$field = :$field";
                $params[":$field"] = $b[$field];
            }
        }

        if (empty($fields)) {
            return [['success' => true], 200]; // Nothing to update
        }

        $sql = 'UPDATE customers SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);

        return [['success' => true]];
    }

    public function get(Request $req, $id): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM customers WHERE id = ?');
        $stmt->execute([(int) $id]);
        $row = $stmt->fetch();
        return $row ?: [['error' => 'Not found'], 404];
    }

    public function list(Request $req): array
    {
        $q = trim((string) ($req->query['q'] ?? ''));
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $size = min(200, max(1, (int) ($req->query['size'] ?? 50)));
        $offset = ($page - 1) * $size;

        $sql = "SELECT id, first_name, last_name, email, phone, city, region
            FROM customers WHERE 1=1";
        $p = [];
        if ($q !== '') {
            $sql .= " AND (first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?)";
            $p[] = "%$q%";
            $p[] = "%$q%";
            $p[] = "%$q%";
        }
        $sql .= " ORDER BY last_name, first_name LIMIT ? OFFSET ?";
        $p[] = $size;
        $p[] = $offset;

        $st = Database::pdo()->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll(), 'page' => $page, 'size' => $size];
    }

    public function listBikes(Request $req, $id): array
    {
        $q = trim((string) ($req->query['q'] ?? ''));
        $pdo = Database::pdo();
        $sql = 'SELECT id, brand, model, model_year, serial_number, color, wheel_size, drivetrain, notes, created_at
                FROM customer_bikes WHERE customer_id = :cid';
        $params = [':cid' => (int) $id];
        if ($q !== '') {
            $sql .= ' AND (brand ILIKE :q OR model ILIKE :q OR serial_number ILIKE :q)';
            $params[':q'] = "%$q%";
        }
        $sql .= ' ORDER BY created_at DESC';
        $st = $pdo->prepare($sql);
        $st->execute($params);
        return ['items' => $st->fetchAll()];
    }
}
