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

        $page = max(1, (int) ($req->query['page'] ?? 1));
        $size = min(200, max(1, (int) ($req->query['size'] ?? 50)));
        $offset = ($page - 1) * $size;

        $sql = "SELECT i.id, i.sku, i.name, b.name AS brand, c.name AS category, i.price, i.reorder_level,
                COALESCE(SUM(s.quantity_on_hand), 0) as stock_quantity
            FROM inventory_items i
            LEFT JOIN brands b ON b.id = i.brand_id
            LEFT JOIN categories c ON c.id = i.category_id
            LEFT JOIN inventory_stock s ON s.item_id = i.id
            WHERE 1=1";
        $p = [];
        if ($q) {
            $sql .= ' AND (i.sku ILIKE ? OR i.name ILIKE ?)';
            $p[] = "%$q%";
            $p[] = "%$q%";
        }
        if ($brand) {
            $sql .= ' AND b.name = ?';
            $p[] = $brand;
        }
        $sql .= ' GROUP BY i.id, i.sku, i.name, b.name, c.name, i.price, i.reorder_level';
        $sql .= ' ORDER BY i.name LIMIT ? OFFSET ?';
        $p[] = $size;
        $p[] = $offset;

        $st = Database::pdo()->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll(), 'page' => $page, 'size' => $size];
    }

    public function create(Request $req): array
    {
        $b = $req->body;
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO inventory_items (sku, name, brand_id, category_id, is_serialized, cost, price, reorder_level)
                VALUES (:sku,:name,:brand_id,:category_id,:is_serialized,:cost,:price,:reorder_level) RETURNING id');

            $brandId = isset($b['brand_id']) && $b['brand_id'] !== '' ? $b['brand_id'] : null;
            $categoryId = isset($b['category_id']) && $b['category_id'] !== '' ? $b['category_id'] : null;

            $stmt->execute([
                ':sku' => $b['sku'],
                ':name' => $b['name'],
                ':brand_id' => $brandId,
                ':category_id' => $categoryId,
                ':is_serialized' => !empty($b['is_serialized']),
                ':cost' => $b['cost'] ?? 0,
                ':price' => $b['price'] ?? 0,
                ':reorder_level' => $b['reorder_level'] ?? 0,
            ]);
            $id = (int) $stmt->fetchColumn();

            // Initialize stock if provided
            if (isset($b['stock_quantity'])) {
                $qty = (int) $b['stock_quantity'];
                // Get default location
                $locStmt = $pdo->query('SELECT id FROM locations ORDER BY id LIMIT 1');
                $locId = $locStmt->fetchColumn();
                if ($locId) {
                    $stockStmt = $pdo->prepare('INSERT INTO inventory_stock (location_id, item_id, quantity_on_hand) VALUES (?, ?, ?)');
                    $stockStmt->execute([$locId, $id, $qty]);
                }
            }

            $pdo->commit();
            return ['id' => $id];
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function update(Request $req, $id): array
    {
        $b = $req->body;
        $fields = [];
        $params = [':id' => (int) $id];
        $pdo = Database::pdo();

        // Separate stock update
        $newStock = null;
        if (array_key_exists('stock_quantity', $b)) {
            $newStock = (int) $b['stock_quantity'];
            unset($b['stock_quantity']);
        }

        $allowed = ['sku', 'name', 'brand_id', 'category_id', 'is_serialized', 'cost', 'price', 'reorder_level'];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $b)) {
                $fields[] = "$field = :$field";
                if ($field === 'is_serialized') {
                    $params[":$field"] = !empty($b[$field]) ? 1 : 0;
                } elseif (($field === 'brand_id' || $field === 'category_id') && $b[$field] === '') {
                    $params[":$field"] = null;
                } elseif (in_array($field, ['cost', 'price', 'reorder_level']) && $b[$field] === '') {
                    $params[":$field"] = 0;
                } else {
                    $params[":$field"] = $b[$field];
                }
            }
        }

        $pdo->beginTransaction();
        try {
            if (!empty($fields)) {
                $sql = 'UPDATE inventory_items SET ' . implode(', ', $fields) . ' WHERE id = :id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }

            if ($newStock !== null) {
                // Get default location
                $locStmt = $pdo->query('SELECT id FROM locations ORDER BY id LIMIT 1');
                $locId = $locStmt->fetchColumn();
                if ($locId) {
                    // Upsert stock
                    $stockStmt = $pdo->prepare('INSERT INTO inventory_stock (location_id, item_id, quantity_on_hand) 
                        VALUES (:loc, :item, :qty) 
                        ON CONFLICT (location_id, item_id) DO UPDATE SET quantity_on_hand = :qty');
                    $stockStmt->execute([':loc' => $locId, ':item' => (int) $id, ':qty' => $newStock]);
                }
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return [['success' => true]];
    }

    public function listBrands(Request $req): array
    {
        $stmt = Database::pdo()->query('SELECT id, name FROM brands ORDER BY name');
        return ['items' => $stmt->fetchAll()];
    }
}