<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: WarrantyController.php
// Description: Warranty controller

namespace App\Controllers;
use App\Http\Request;
use App\Database;

final class WarrantyController
{
    public function createTemplate(Request $req): array
    {
        $b = $req->body;
        $st = Database::pdo()->prepare(
            'INSERT INTO warranties(name, brand_id, item_id, duration_months, terms)
           VALUES (:name,:brand_id,:item_id,:dur,:terms) RETURNING id'
        );
        $st->execute([
            ':name' => $b['name'],
            ':brand_id' => $b['brand_id'] ?? null,
            ':item_id' => $b['item_id'] ?? null,
            ':dur' => $b['duration_months'] ?? 12,
            ':terms' => $b['terms'] ?? null
        ]);
        return ['id' => (int) $st->fetchColumn()];
    }

    public function registerForCustomer(Request $req, $customerId): array
    {
        $b = $req->body;
        $st = Database::pdo()->prepare(
            'INSERT INTO customer_warranties
           (customer_id,bike_id,inventory_item_id,serial_number,warranty_id,status,purchase_date,start_date,duration_months,notes)
           SELECT :cid,:bike_id,:item_id,:serial,:wid,:status,:pdate,:sdate,
                  COALESCE(:duration,(SELECT duration_months FROM warranties WHERE id=:wid)), :notes
           RETURNING id'
        );
        $st->execute([
            ':cid' => (int) $customerId,
            ':bike_id' => $b['bike_id'] ?? null,
            ':item_id' => $b['inventory_item_id'] ?? null,
            ':serial' => $b['serial_number'] ?? null,
            ':wid' => (int) $b['warranty_id'],
            ':status' => $b['status'] ?? 'active',
            ':pdate' => $b['purchase_date'] ?? date('Y-m-d'),
            ':sdate' => $b['start_date'] ?? date('Y-m-d'),
            ':duration' => $b['duration_months'] ?? null,
            ':notes' => $b['notes'] ?? null,
        ]);
        return ['id' => (int) $st->fetchColumn()];
    }

    public function listForCustomer(Request $req, $customerId): array
    {
        $st = Database::pdo()->prepare(
            'SELECT cw.*, w.name AS template_name
             FROM customer_warranties cw
             JOIN warranties w ON w.id = cw.warranty_id
            WHERE cw.customer_id = ?
            ORDER BY cw.start_date DESC'
        );
        $st->execute([(int) $customerId]);
        return $st->fetchAll();
    }
    public function list(Request $req): array
    {
        $q = $req->query['q'] ?? null;
        $status = $req->query['status'] ?? null;
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $size = min(200, max(1, (int) ($req->query['size'] ?? 50)));
        $offset = ($page - 1) * $size;

        $sql = "SELECT cw.id, cw.status, cw.start_date, cw.end_date, cw.serial_number,
                       w.name AS warranty_name,
                       c.first_name || ' ' || c.last_name AS customer_name,
                       COALESCE(cb.brand || ' ' || cb.model, i.name) AS item_name
                FROM customer_warranties cw
                JOIN warranties w ON w.id = cw.warranty_id
                JOIN customers c ON c.id = cw.customer_id
                LEFT JOIN customer_bikes cb ON cb.id = cw.bike_id
                LEFT JOIN inventory_items i ON i.id = cw.inventory_item_id
                WHERE 1=1";

        $params = [];
        if ($q) {
            $sql .= " AND (c.first_name ILIKE ? OR c.last_name ILIKE ? OR cw.serial_number ILIKE ? OR w.name ILIKE ?)";
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
        }
        if ($status) {
            $sql .= " AND cw.status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY cw.start_date DESC LIMIT ? OFFSET ?";
        $params[] = $size;
        $params[] = $offset;

        $st = Database::pdo()->prepare($sql);
        $st->execute($params);
        return ['items' => $st->fetchAll(), 'page' => $page, 'size' => $size];
    }

    public function listTemplates(Request $req): array
    {
        $st = Database::pdo()->query('SELECT id, name, duration_months, terms FROM warranties ORDER BY name');
        return ['items' => $st->fetchAll()];
    }

    public function update(Request $req, $id): array
    {
        $b = $req->body;
        $fields = [];
        $params = [':id' => (int) $id];

        if (array_key_exists('status', $b)) {
            $fields[] = "status = :status";
            $params[':status'] = $b['status'];
        }
        if (array_key_exists('notes', $b)) {
            $fields[] = "notes = :notes";
            $params[':notes'] = $b['notes'];
        }

        if (empty($fields)) {
            return [['success' => true]];
        }

        $sql = "UPDATE customer_warranties SET " . implode(', ', $fields) . " WHERE id = :id";
        $st = Database::pdo()->prepare($sql);
        $st->execute($params);

        return [['success' => true]];
    }
}
