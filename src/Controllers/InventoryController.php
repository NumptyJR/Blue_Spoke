<?php
namespace App\Controllers;
use App\Http\Request;
use App\Database;

final class InventoryController
{
    public function list(Request $req): array
    {
        $q = $req->query['q'] ?? null;
        $brand = $req->query['brand'] ?? null;

        $page = max(1, (int)($req->query['page'] ?? 1));
        $size = min(200, max(1, (int)($req->query['size'] ?? 50)));
        $offset = ($page - 1) * $size;

        $sql = "SELECT i.id, i.sku, i.name, b.name AS brand, c.name AS category, i.price, i.reorder_level
            FROM inventory_items i
            LEFT JOIN brands b ON b.id = i.brand_id
            LEFT JOIN categories c ON c.id = i.category_id
            WHERE 1=1";
        $p = [];
        if ($q) { $sql .= ' AND (i.sku ILIKE ? OR i.name ILIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
        if ($brand) { $sql .= ' AND b.name = ?'; $p[] = $brand; }
        $sql .= ' ORDER BY i.name LIMIT ? OFFSET ?';
        $p[] = $size; $p[] = $offset;

        $st = Database::pdo()->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll(), 'page' => $page, 'size' => $size];
    }

    public function create(Request $req): array
    {
        $b = $req->body;
        $stmt = Database::pdo()->prepare('INSERT INTO inventory_items (sku, name, brand_id, category_id, is_serialized, cost, price, reorder_level)
            VALUES (:sku,:name,:brand_id,:category_id,:is_serialized,:cost,:price,:reorder_level) RETURNING id');
        $stmt->execute([
            ':sku' => $b['sku'], ':name' => $b['name'], ':brand_id' => $b['brand_id'] ?? null, ':category_id' => $b['category_id'] ?? null,
            ':is_serialized' => !empty($b['is_serialized']), ':cost' => $b['cost'] ?? 0, ':price' => $b['price'] ?? 0, ':reorder_level' => $b['reorder_level'] ?? 0,
        ]);
        return ['id' => (int)$stmt->fetchColumn()];
    }
}