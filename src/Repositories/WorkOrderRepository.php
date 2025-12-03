<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: WorkOrderRepository.php
// Description: Work order repository

namespace App\Repositories;

use App\Database;
use PDO;
use PDOException;

class WorkOrderRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::pdo();
    }

    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare('INSERT INTO work_orders (status, customer_id, bike_id, opened_by, assigned_to, promised_at, notes, location_id)
            VALUES (:status, :customer_id, :bike_id, :opened_by, :assigned_to, :promised_at, :notes, :location_id) RETURNING id');

        $stmt->execute([
            ':status' => $data['status'] ?? 'open',
            ':customer_id' => $data['customer_id'],
            ':bike_id' => $data['bike_id'] ?? null,
            ':opened_by' => $data['opened_by'] ?? null,
            ':assigned_to' => $data['assigned_to'] ?? null,
            ':promised_at' => $data['promised_at'] ?? null,
            ':notes' => $data['notes'] ?? null,
            ':location_id' => $data['location_id'] ?? 1, // Default to location 1 since it is the only one atm
        ]);

        return (int) $stmt->fetchColumn();
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM work_orders WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $wo = $stmt->fetch();
        if (!$wo)
            return null;

        // Fetch related data
        if (!empty($wo['bike_id'])) {
            $bq = $this->pdo->prepare('SELECT * FROM customer_bikes WHERE id = :id');
            $bq->execute([':id' => $wo['bike_id']]);
            $bike = $bq->fetch();
            if ($bike)
                $wo['bike'] = $bike;
        }

        if (!empty($wo['customer_id'])) {
            $cq = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
            $cq->execute([':id' => $wo['customer_id']]);
            $customer = $cq->fetch();
            if ($customer)
                $wo['customer'] = $customer;
        }

        return $wo;
    }

    public function getLines(int $woId): array
    {
        $svc = $this->pdo->prepare('SELECT l.*, s.code, s.name FROM work_order_service_lines l JOIN services_catalog s ON s.id = l.service_id WHERE l.work_order_id = ? ORDER BY l.id');
        $svc->execute([$woId]);

        $parts = $this->pdo->prepare('SELECT l.*, i.sku, i.name FROM work_order_part_lines l JOIN inventory_items i ON i.id = l.item_id WHERE l.work_order_id = ? ORDER BY l.id');
        $parts->execute([$woId]);

        return [
            'services' => $svc->fetchAll(),
            'parts' => $parts->fetchAll()
        ];
    }

    public function update(int $id, array $data): bool
    {
        $set = [];
        $params = [':id' => $id];

        foreach (['customer_id', 'bike_id', 'assigned_to', 'promised_at', 'notes'] as $field) {
            if (array_key_exists($field, $data)) {
                $set[] = "$field = :$field";
                $params[":$field"] = $data[$field];
            }
        }

        if (empty($set))
            return true;

        $sql = 'UPDATE work_orders SET ' . implode(', ', $set) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public function updateStatus(int $id, string $status): ?array
    {
        $stmt = $this->pdo->prepare('UPDATE work_orders SET status = :s WHERE id = :id RETURNING id, status, closed_at');
        try {
            $stmt->execute([':s' => $status, ':id' => $id]);
            $row = $stmt->fetch();
            return $row ?: null;
        } catch (PDOException $e) {
            $errorInfo = $stmt->errorInfo();
            $sqlState = $errorInfo[0] ?? $e->getCode();
            if (in_array($sqlState, ['23514', '23505', '23000'])) {
                throw new \DomainException('Illegal status transition');
            }
            throw $e;
        }
    }

    public function addPartLine(int $woId, int $itemId, int $qty, ?string $notes, float $price): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO work_order_part_lines (work_order_id, item_id, quantity, unit_price, notes)
            VALUES (:wo, :item, :qty, :price, :notes)');
        $stmt->execute([
            ':wo' => $woId,
            ':item' => $itemId,
            ':qty' => $qty,
            ':price' => $price,
            ':notes' => $notes
        ]);
    }

    public function addServiceLine(int $woId, int $serviceId, int $qty, ?int $assignedTo, ?string $notes, float $price, int $minutes): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to, notes)
            VALUES (:wo, :svc, :qty, :mins, :price, :assigned, :notes)');
        $stmt->execute([
            ':wo' => $woId,
            ':svc' => $serviceId,
            ':qty' => $qty,
            ':mins' => $minutes,
            ':price' => $price,
            ':assigned' => $assignedTo,
            ':notes' => $notes
        ]);
    }

    public function removePartLine(int $woId, int $lineId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM work_order_part_lines WHERE work_order_id = :wo AND id = :id');
        $stmt->execute([':wo' => $woId, ':id' => $lineId]);
        return $stmt->rowCount() > 0;
    }

    public function removeServiceLine(int $woId, int $lineId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM work_order_service_lines WHERE id = :id AND work_order_id = :wo_id');
        $stmt->execute([':id' => $lineId, ':wo_id' => $woId]);
        return $stmt->rowCount() > 0;
    }

    public function updatePartLine(int $woId, int $lineId, int $qty): bool
    {
        $stmt = $this->pdo->prepare('UPDATE work_order_part_lines SET quantity = :qty WHERE id = :id AND work_order_id = :wo_id');
        return $stmt->execute([':qty' => $qty, ':id' => $lineId, ':wo_id' => $woId]);
    }

    public function updateServiceLine(int $woId, int $lineId, int $qty): bool
    {
        $stmt = $this->pdo->prepare('UPDATE work_order_service_lines SET quantity = :qty WHERE id = :id AND work_order_id = :wo_id');
        return $stmt->execute([':qty' => $qty, ':id' => $lineId, ':wo_id' => $woId]);
    }

    public function list(array $filters, int $page = 1, int $size = 50): array
    {
        $offset = ($page - 1) * $size;
        $sql = "SELECT wo.id, wo.status, wo.opened_at, wo.promised_at,
                   c.first_name || ' ' || c.last_name AS customer,
                   cb.brand || ' ' || COALESCE(cb.model,'') AS bike,
                   u.full_name AS assigned_to
            FROM work_orders wo
            JOIN customers c ON c.id = wo.customer_id
            LEFT JOIN customer_bikes cb ON cb.id = wo.bike_id
            LEFT JOIN users u ON u.id = wo.assigned_to
            WHERE 1=1";

        $params = [];
        if (!empty($filters['status'])) {
            $in = array_map('trim', explode(',', $filters['status']));
            $place = implode(',', array_fill(0, count($in), '?'));
            $sql .= " AND wo.status IN ($place)";
            array_push($params, ...$in);
        }

        $sql .= " ORDER BY wo.opened_at DESC LIMIT ? OFFSET ?";
        $params[] = $size;
        $params[] = $offset;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }
}
