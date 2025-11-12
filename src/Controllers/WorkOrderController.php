<?php
namespace App\Controllers;
use App\Http\Request;
use App\Database;
use PDO;
use PDOException;
use Throwable;

final class WorkOrderController
{
    public function create(Request $req): array
    {
        $b = $req->body; $pdo = Database::pdo(); $pdo->beginTransaction();
        try {
            $bikeId = $b['bike_id'] ?? null;
            if (!$bikeId && isset($b['bike'])) {
                $st = $pdo->prepare('INSERT INTO customer_bikes (customer_id,brand,model,model_year,serial_number,color,wheel_size,drivetrain,notes)
                    VALUES (:customer_id,:brand,:model,:model_year,:serial_number,:color,:wheel_size,:drivetrain,:notes) RETURNING id');
                $st->execute([
                    ':customer_id' => (int)$b['customer_id'], ':brand' => $b['bike']['brand'] ?? 'Unknown', ':model' => $b['bike']['model'] ?? null,
                    ':model_year' => $b['bike']['model_year'] ?? null, ':serial_number' => $b['bike']['serial_number'] ?? null,
                    ':color' => $b['bike']['color'] ?? null, ':wheel_size' => $b['bike']['wheel_size'] ?? null,
                    ':drivetrain' => $b['bike']['drivetrain'] ?? null, ':notes' => $b['bike']['notes'] ?? null,
                ]);
                $bikeId = (int)$st->fetchColumn();
            }
            $st = $pdo->prepare('INSERT INTO work_orders (status, customer_id, bike_id, opened_by, assigned_to, promised_at, notes)
                VALUES (:status,:customer_id,:bike_id,:opened_by,:assigned_to,:promised_at,:notes) RETURNING id');
            $st->execute([
                ':status' => $b['status'] ?? 'open', ':customer_id' => (int)$b['customer_id'], ':bike_id' => $bikeId,
                ':opened_by' => (int)($req->user['id'] ?? $b['opened_by'] ?? 0), ':assigned_to' => $b['assigned_to'] ?? null,
                ':promised_at' => $b['promised_at'] ?? null, ':notes' => $b['notes'] ?? null,
            ]);
            $woId = (int)$st->fetchColumn();

            // validate and insert initial services if provided
            $initial = $b['services'] ?? [];
            if (!empty($initial)) {
                $errors = [];
                foreach ($initial as $idx => $svc) {
                    $qty = isset($svc['quantity']) ? (int)$svc['quantity'] : 1;
                    if ($qty <= 0) { $errors[] = ['index'=>$idx, 'error'=>'quantity must be > 0']; continue; }
                    $assigned = $svc['assigned_to'] ?? $b['assigned_to'] ?? null;
                    if (isset($svc['service_id'])) {
                        $sid = (int)$svc['service_id']; if ($sid <= 0) { $errors[]=['index'=>$idx,'error'=>'service_id must be a positive integer']; continue; }
                        $ins = $pdo->prepare('INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to, notes)
                            SELECT :wo, s.id, :qty, s.default_minutes, s.default_price, :assigned, :notes FROM services_catalog s WHERE s.id=:sid');
                        $ins->execute([':wo'=>$woId, ':qty'=>$qty, ':assigned'=>$assigned, ':notes'=>$svc['notes']??null, ':sid'=>$sid]);
                        if ($ins->rowCount() === 0) { $errors[] = ['index'=>$idx, 'error'=>'service not found', 'service_id'=>$sid]; }
                    } elseif (isset($svc['service_code'])) {
                        $scode = (string)$svc['service_code']; if ($scode === '') { $errors[]=['index'=>$idx,'error'=>'service_code required']; continue; }
                        $ins = $pdo->prepare('INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to, notes)
                            SELECT :wo, s.id, :qty, s.default_minutes, s.default_price, :assigned, :notes FROM services_catalog s WHERE s.code=:scode');
                        $ins->execute([':wo'=>$woId, ':qty'=>$qty, ':assigned'=>$assigned, ':notes'=>$svc['notes']??null, ':scode'=>$scode]);
                        if ($ins->rowCount() === 0) { $errors[] = ['index'=>$idx, 'error'=>'service not found', 'service_code'=>$scode]; }
                    } else {
                        $errors[] = ['index'=>$idx, 'error'=>'service_id or service_code required'];
                    }
                }
                if (!empty($errors)) { $pdo->rollBack(); return [['errors'=>$errors], 422]; }
            }
            $pdo->commit();
            return ['id' => $woId];
        } catch (Throwable $e) {
            $pdo->rollBack(); throw $e;
        }
    }

    public function addParts(Request $req, $id): array
    {
        $pdo = Database::pdo(); $pdo->beginTransaction();
        try {
            $items = $req->body['items'] ?? [];
            if (!is_array($items) || empty($items)) { $pdo->rollBack(); return [['error' => 'items array required'], 422]; }
            $errors = [];
            foreach ($items as $idx => $it) {
                $iid = isset($it['item_id']) ? (int)$it['item_id'] : 0;
                $qty = isset($it['quantity']) ? (int)$it['quantity'] : 1;
                if ($iid <= 0) { $errors[] = [ 'index'=>$idx, 'error'=>'item_id must be a positive integer' ]; continue; }
                if ($qty <= 0) { $errors[] = [ 'index'=>$idx, 'error'=>'quantity must be > 0' ]; continue; }
                $ins = $pdo->prepare('INSERT INTO work_order_part_lines (work_order_id,item_id,quantity,unit_price,notes)
                    SELECT :wo, i.id, :q, i.price, :n FROM inventory_items i WHERE i.id=:iid');
                $ins->execute([':wo'=>(int)$id, ':iid'=>$iid, ':q'=>$qty, ':n'=>$it['notes']??null]);
                if ($ins->rowCount() === 0) { $errors[] = [ 'index'=>$idx, 'error'=>'item not found', 'item_id'=>$iid ]; }
            }
            if (!empty($errors)) { $pdo->rollBack(); return [['errors'=>$errors], 422]; }
            $pdo->commit();
            return ['ok' => true];
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    }
    public function addServices(Request $req, $id): array
    {
        $pdo = Database::pdo(); $pdo->beginTransaction();
        try {
            $items = $req->body['items'] ?? [];
            if (!is_array($items) || empty($items)) { $pdo->rollBack(); return [['error' => 'items array required'], 422]; }
            $errors = [];
            foreach ($items as $idx => $svc) {
                $qty = isset($svc['quantity']) ? (int)$svc['quantity'] : 1;
                if ($qty <= 0) { $errors[] = [ 'index'=>$idx, 'error'=>'quantity must be > 0' ]; continue; }
                if (isset($svc['service_id'])) {
                    $sid = (int)$svc['service_id']; if ($sid <= 0) { $errors[] = ['index'=>$idx, 'error'=>'service_id must be a positive integer']; continue; }
                    $ins = $pdo->prepare('INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to, notes)
                        SELECT :wo, s.id, :qty, s.default_minutes, s.default_price, :assigned_to, :notes FROM services_catalog s WHERE s.id=:sid');
                    $ins->execute([':wo'=>(int)$id, ':qty'=>$qty, ':assigned_to'=>$svc['assigned_to']??null, ':notes'=>$svc['notes']??null, ':sid'=>$sid]);
                    if ($ins->rowCount() === 0) { $errors[] = [ 'index'=>$idx, 'error'=>'service not found', 'service_id'=>$sid ]; }
                } elseif (isset($svc['service_code'])) {
                    $scode = (string)$svc['service_code']; if ($scode === '') { $errors[] = ['index'=>$idx, 'error'=>'service_code required']; continue; }
                    $ins = $pdo->prepare('INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to, notes)
                        SELECT :wo, s.id, :qty, s.default_minutes, s.default_price, :assigned_to, :notes FROM services_catalog s WHERE s.code=:scode');
                    $ins->execute([':wo'=>(int)$id, ':qty'=>$qty, ':assigned_to'=>$svc['assigned_to']??null, ':notes'=>$svc['notes']??null, ':scode'=>$scode]);
                    if ($ins->rowCount() === 0) { $errors[] = [ 'index'=>$idx, 'error'=>'service not found', 'service_code'=>$scode ]; }
                } else {
                    $errors[] = [ 'index'=>$idx, 'error'=>'service_id or service_code required' ];
                }
            }
            if (!empty($errors)) { $pdo->rollBack(); return [['errors'=>$errors], 422]; }
            $pdo->commit();
            return ['ok' => true];
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    }

    public function deletePart(Request $req, $woId, $lineId): array
    {
        $st = Database::pdo()->prepare('DELETE FROM work_order_part_lines WHERE work_order_id = :wo AND id = :id RETURNING id');
        $st->execute([':wo' => (int)$woId, ':id' => (int)$lineId]);
        $id = $st->fetchColumn();
        return $id ? ['ok' => true] : [['error' => 'Not found'], 404];
    }

    public function deleteService(Request $req, $woId, $lineId): array
    {
        $st = Database::pdo()->prepare('DELETE FROM work_order_service_lines WHERE work_order_id = :wo AND id = :id RETURNING id');
        $st->execute([':wo' => (int)$woId, ':id' => (int)$lineId]);
        $id = $st->fetchColumn();
        return $id ? ['ok' => true] : [['error' => 'Not found'], 404];
    }
    public function get(Request $req, $id): array
    {
        $pdo = Database::pdo();
        $wo = $pdo->prepare('SELECT * FROM work_orders WHERE id = ?'); $wo->execute([(int)$id]); $h = $wo->fetch();
        if (!$h) return [['error' => 'Not found'], 404];
        // Attach bike details if available
        if (!empty($h['bike_id'])) {
            $bq = $pdo->prepare('SELECT id, customer_id, brand, model, model_year, serial_number, color, wheel_size, drivetrain, notes FROM customer_bikes WHERE id = ?');
            $bq->execute([(int)$h['bike_id']]);
            $bike = $bq->fetch();
            if ($bike) $h['bike'] = $bike;
        }
        $svc = $pdo->prepare('SELECT l.*, s.code, s.name FROM work_order_service_lines l JOIN services_catalog s ON s.id = l.service_id WHERE l.work_order_id = ? ORDER BY l.id'); $svc->execute([(int)$id]);
        $parts = $pdo->prepare('SELECT l.*, i.sku, i.name FROM work_order_part_lines l JOIN inventory_items i ON i.id = l.item_id WHERE l.work_order_id = ? ORDER BY l.id'); $parts->execute([(int)$id]);
        $services = $svc->fetchAll();
        $partsLines = $parts->fetchAll();
        $labor = 0;
        foreach ($services as $line) {
            $qty = (int)($line['quantity'] ?? 1);
            $price = (float)($line['price'] ?? 0);
            $labor += $qty * $price;
        }
        $partsTotal = 0;
        foreach ($partsLines as $line) {
            $qty = (int)($line['quantity'] ?? 1);
            $price = (float)($line['unit_price'] ?? 0);
            $partsTotal += $qty * $price;
        }
        $totals = [
            'labor_subtotal' => $labor,
            'parts_subtotal' => $partsTotal,
            'total' => $labor + $partsTotal,
        ];
        return ['work_order'=>$h, 'services'=>$services, 'parts'=>$partsLines, 'totals'=>$totals];
    }

    public function updateStatus(Request $req, $id): array
    {
        $next = (string)($req->body['status'] ?? '');
        if ($next === '') return [['error'=>'status required'], 422];

        $st = Database::pdo()->prepare('UPDATE work_orders SET status = :s WHERE id = :id RETURNING id,status,closed_at');
        try {
            $st->execute([':s'=>$next, ':id'=>(int)$id]);
        } catch (PDOException $e) {
            $errorInfo = $st->errorInfo();
            $sqlState = $errorInfo[0] ?? $e->getCode();
            if ($sqlState === '23514' || $sqlState === '23505' || $sqlState === '23000') {
                return [['error'=>'Illegal status transition'], 409];
            }
            throw $e;
        }
        $row = $st->fetch();
        return $row ?: [['error'=>'Not found'], 404];
    }

    public function list(Request $req): array
    {
        $status = $req->query['status'] ?? null;
        $page = max(1, (int)($req->query['page'] ?? 1));
        $size = min(200, max(1, (int)($req->query['size'] ?? 50)));
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
        $p = [];
        if ($status) {
            $in = array_map('trim', explode(',', $status));
            $place = implode(',', array_fill(0, count($in), '?'));
            $sql .= " AND wo.status IN ($place)";
            array_push($p, ...$in);
        }
        $sql .= " ORDER BY wo.opened_at DESC LIMIT ? OFFSET ?";
        $p[] = $size; $p[] = $offset;

        $st = Database::pdo()->prepare($sql);
        $st->execute($p);
        return ['items' => $st->fetchAll(), 'page' => $page, 'size' => $size];
    }

    public function update(Request $req, $id): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $id = (int)$id;
            $b = $req->body ?? [];
            // Fetch current WO (customer_id is needed for bike creation)
            $st = $pdo->prepare('SELECT customer_id, bike_id FROM work_orders WHERE id = ? FOR UPDATE');
            $st->execute([$id]);
            $current = $st->fetch();
            if (!$current) { $pdo->rollBack(); return [['error' => 'Not found'], 404]; }

            $customerId = isset($b['customer_id']) ? (int)$b['customer_id'] : (int)$current['customer_id'];
            $bikeId = isset($b['bike_id']) && $b['bike_id'] !== null && $b['bike_id'] !== ''
                ? (int)$b['bike_id']
                : (int)($current['bike_id'] ?? 0);

            // Handle bike data
            if (isset($b['bike']) && is_array($b['bike'])) {
                $bike = $b['bike'];
                $targetBikeId = isset($bike['id']) ? (int)$bike['id'] : ($bikeId ?: 0);
                if ($targetBikeId) {
                    // Update existing bike
                    $upd = $pdo->prepare('UPDATE customer_bikes SET brand = COALESCE(:brand, brand), model = COALESCE(:model, model), model_year = COALESCE(:model_year, model_year), serial_number = COALESCE(:serial_number, serial_number), color = COALESCE(:color, color), wheel_size = COALESCE(:wheel_size, wheel_size), drivetrain = COALESCE(:drivetrain, drivetrain), notes = COALESCE(:notes, notes) WHERE id = :id RETURNING id');
                    $upd->execute([
                        ':brand' => $bike['brand'] ?? null,
                        ':model' => $bike['model'] ?? null,
                        ':model_year' => $bike['model_year'] ?? null,
                        ':serial_number' => $bike['serial_number'] ?? null,
                        ':color' => $bike['color'] ?? null,
                        ':wheel_size' => $bike['wheel_size'] ?? null,
                        ':drivetrain' => $bike['drivetrain'] ?? null,
                        ':notes' => $bike['notes'] ?? null,
                        ':id' => $targetBikeId,
                    ]);
                    $bikeId = (int)$upd->fetchColumn();
                } else {
                    // Create new bike for the (possibly updated) customer
                    $ins = $pdo->prepare('INSERT INTO customer_bikes (customer_id,brand,model,model_year,serial_number,color,wheel_size,drivetrain,notes)
                        VALUES (:customer_id,:brand,:model,:model_year,:serial_number,:color,:wheel_size,:drivetrain,:notes) RETURNING id');
                    $ins->execute([
                        ':customer_id' => $customerId,
                        ':brand' => $bike['brand'] ?? 'Unknown',
                        ':model' => $bike['model'] ?? null,
                        ':model_year' => $bike['model_year'] ?? null,
                        ':serial_number' => $bike['serial_number'] ?? null,
                        ':color' => $bike['color'] ?? null,
                        ':wheel_size' => $bike['wheel_size'] ?? null,
                        ':drivetrain' => $bike['drivetrain'] ?? null,
                        ':notes' => $bike['notes'] ?? null,
                    ]);
                    $bikeId = (int)$ins->fetchColumn();
                }
            }

            // Update header fields
            $fields = [
                'customer_id' => $customerId,
                'assigned_to' => array_key_exists('assigned_to', $b) ? ($b['assigned_to'] !== null && $b['assigned_to'] !== '' ? (int)$b['assigned_to'] : null) : null,
                'promised_at' => array_key_exists('promised_at', $b) ? ($b['promised_at'] ?: null) : null,
                'notes' => array_key_exists('notes', $b) ? ($b['notes'] ?? null) : null,
                'bike_id' => $bikeId ?: null,
            ];
            $set = ['customer_id = :customer_id','bike_id = :bike_id'];
            $params = [':customer_id'=>$fields['customer_id'], ':bike_id'=>$fields['bike_id']];
            if (array_key_exists('assigned_to', $b)) { $set[] = 'assigned_to = :assigned_to'; $params[':assigned_to'] = $fields['assigned_to']; }
            if (array_key_exists('promised_at', $b)) { $set[] = 'promised_at = :promised_at'; $params[':promised_at'] = $fields['promised_at']; }
            if (array_key_exists('notes', $b)) { $set[] = 'notes = :notes'; $params[':notes'] = $fields['notes']; }

            if (!empty($set)) {
                $sql = 'UPDATE work_orders SET ' . implode(',', $set) . ' WHERE id = :id RETURNING id';
                $params[':id'] = $id;
                $upd = $pdo->prepare($sql); $upd->execute($params);
                $upd->fetchColumn();
            }

            // Optional status update obeying guard
            if (isset($b['status']) && $b['status'] !== '') {
                $st = $pdo->prepare('UPDATE work_orders SET status = :s WHERE id = :id RETURNING id');
                $st->execute([':s'=>$b['status'], ':id'=>$id]);
                $st->fetchColumn();
            }

            $pdo->commit();
            return ['id' => $id, 'ok' => true];
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    }
}
