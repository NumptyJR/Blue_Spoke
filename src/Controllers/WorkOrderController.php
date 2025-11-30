<?php
namespace App\Controllers;

use App\Http\Request;
use App\Database;
use App\Repositories\WorkOrderRepository;
use App\Repositories\InventoryRepository;
use Throwable;

final class WorkOrderController
{
    private WorkOrderRepository $woRepo;
    private InventoryRepository $invRepo;

    public function __construct()
    {
        $this->woRepo = new WorkOrderRepository();
        $this->invRepo = new InventoryRepository();
    }

    public function create(Request $req): array
    {
        $b = $req->body;
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $bikeId = $b['bike_id'] ?? null;
            if (!$bikeId && isset($b['bike'])) {
                // Bike creation logic
                $st = $pdo->prepare('INSERT INTO customer_bikes (customer_id,brand,model,model_year,serial_number,color,wheel_size,drivetrain,notes)
                    VALUES (:customer_id,:brand,:model,:model_year,:serial_number,:color,:wheel_size,:drivetrain,:notes) RETURNING id');
                $st->execute([
                    ':customer_id' => (int) $b['customer_id'],
                    ':brand' => $b['bike']['brand'] ?? 'Unknown',
                    ':model' => $b['bike']['model'] ?? null,
                    ':model_year' => $b['bike']['model_year'] ?? null,
                    ':serial_number' => $b['bike']['serial_number'] ?? null,
                    ':color' => $b['bike']['color'] ?? null,
                    ':wheel_size' => $b['bike']['wheel_size'] ?? null,
                    ':drivetrain' => $b['bike']['drivetrain'] ?? null,
                    ':notes' => $b['bike']['notes'] ?? null,
                ]);
                $bikeId = (int) $st->fetchColumn();
            }

            $woData = [
                'status' => $b['status'] ?? 'open',
                'customer_id' => (int) $b['customer_id'],
                'bike_id' => $bikeId,
                'opened_by' => (int) ($req->user['id'] ?? $b['opened_by'] ?? 0),
                'assigned_to' => $b['assigned_to'] ?? null,
                'promised_at' => $b['promised_at'] ?? null,
                'notes' => $b['notes'] ?? null,
                'location_id' => $b['location_id'] ?? null,
            ];

            $woId = $this->woRepo->create($woData);

            // validate and insert initial services if provided
            $initial = $b['services'] ?? [];
            if (!empty($initial)) {
                $errors = [];
                foreach ($initial as $idx => $svc) {
                    $qty = isset($svc['quantity']) ? (int) $svc['quantity'] : 1;
                    if ($qty <= 0) {
                        $errors[] = ['index' => $idx, 'error' => 'quantity must be > 0'];
                        continue;
                    }
                    $assigned = $svc['assigned_to'] ?? $b['assigned_to'] ?? null;

                    $service = null;
                    if (isset($svc['service_id'])) {
                        $sid = (int) $svc['service_id'];
                        if ($sid <= 0) {
                            $errors[] = ['index' => $idx, 'error' => 'service_id must be a positive integer'];
                            continue;
                        }
                        $service = $this->invRepo->findServiceById($sid);
                        if (!$service) {
                            $errors[] = ['index' => $idx, 'error' => 'service not found', 'service_id' => $sid];
                            continue;
                        }
                    } elseif (isset($svc['service_code'])) {
                        $scode = (string) $svc['service_code'];
                        if ($scode === '') {
                            $errors[] = ['index' => $idx, 'error' => 'service_code required'];
                            continue;
                        }
                        $service = $this->invRepo->findServiceByCode($scode);
                        if (!$service) {
                            $errors[] = ['index' => $idx, 'error' => 'service not found', 'service_code' => $scode];
                            continue;
                        }
                    } else {
                        $errors[] = ['index' => $idx, 'error' => 'service_id or service_code required'];
                        continue;
                    }

                    if ($service) {
                        $this->woRepo->addServiceLine(
                            $woId,
                            $service['id'],
                            $qty,
                            $assigned,
                            $svc['notes'] ?? null,
                            $service['default_price'],
                            $service['default_minutes']
                        );
                    }
                }
                if (!empty($errors)) {
                    $pdo->rollBack();
                    return [['errors' => $errors], 422];
                }
            }
            $pdo->commit();
            return ['id' => $woId];
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function addParts(Request $req, $id): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $items = $req->body['items'] ?? [];
            if (!is_array($items) || empty($items)) {
                $pdo->rollBack();
                return [['error' => 'items array required'], 422];
            }
            $errors = [];
            foreach ($items as $idx => $it) {
                $iid = isset($it['item_id']) ? (int) $it['item_id'] : 0;
                $qty = isset($it['quantity']) ? (int) $it['quantity'] : 1;
                if ($iid <= 0) {
                    $errors[] = ['index' => $idx, 'error' => 'item_id must be a positive integer'];
                    continue;
                }
                if ($qty <= 0) {
                    $errors[] = ['index' => $idx, 'error' => 'quantity must be > 0'];
                    continue;
                }

                $item = $this->invRepo->findItemById($iid);
                if (!$item) {
                    $errors[] = ['index' => $idx, 'error' => 'item not found', 'item_id' => $iid];
                    continue;
                }

                $this->woRepo->addPartLine($id, $iid, $qty, $it['notes'] ?? null, $item['price']);
            }
            if (!empty($errors)) {
                $pdo->rollBack();
                return [['errors' => $errors], 422];
            }
            $pdo->commit();
            return ['ok' => true];
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function addServices(Request $req, $id): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $items = $req->body['items'] ?? [];
            if (!is_array($items) || empty($items)) {
                $pdo->rollBack();
                return [['error' => 'items array required'], 422];
            }
            $errors = [];
            foreach ($items as $idx => $svc) {
                $qty = isset($svc['quantity']) ? (int) $svc['quantity'] : 1;
                if ($qty <= 0) {
                    $errors[] = ['index' => $idx, 'error' => 'quantity must be > 0'];
                    continue;
                }

                $service = null;
                if (isset($svc['service_id'])) {
                    $sid = (int) $svc['service_id'];
                    if ($sid <= 0) {
                        $errors[] = ['index' => $idx, 'error' => 'service_id must be a positive integer'];
                        continue;
                    }
                    $service = $this->invRepo->findServiceById($sid);
                    if (!$service) {
                        $errors[] = ['index' => $idx, 'error' => 'service not found', 'service_id' => $sid];
                        continue;
                    }
                } elseif (isset($svc['service_code'])) {
                    $scode = (string) $svc['service_code'];
                    if ($scode === '') {
                        $errors[] = ['index' => $idx, 'error' => 'service_code required'];
                        continue;
                    }
                    $service = $this->invRepo->findServiceByCode($scode);
                    if (!$service) {
                        $errors[] = ['index' => $idx, 'error' => 'service not found', 'service_code' => $scode];
                        continue;
                    }
                } else {
                    $errors[] = ['index' => $idx, 'error' => 'service_id or service_code required'];
                    continue;
                }

                if ($service) {
                    $this->woRepo->addServiceLine(
                        $id,
                        $service['id'],
                        $qty,
                        $svc['assigned_to'] ?? null,
                        $svc['notes'] ?? null,
                        $service['default_price'],
                        $service['default_minutes']
                    );
                }
            }
            if (!empty($errors)) {
                $pdo->rollBack();
                return [['errors' => $errors], 422];
            }
            $pdo->commit();
            return ['ok' => true];
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function deletePart(Request $req, $woId, $lineId): array
    {
        $ok = $this->woRepo->removePartLine((int) $woId, (int) $lineId);
        return $ok ? ['ok' => true] : [['error' => 'Not found'], 404];
    }

    public function deleteService(Request $req, $woId, $lineId): array
    {
        $ok = $this->woRepo->removeServiceLine((int) $woId, (int) $lineId);
        return $ok ? ['ok' => true] : [['error' => 'Not found'], 404];
    }

    public function updatePartLine(Request $req, $woId, $lineId): array
    {
        $qty = (int) ($req->body['quantity'] ?? 0);
        if ($qty <= 0)
            return [['error' => 'quantity must be > 0'], 422];

        $ok = $this->woRepo->updatePartLine((int) $woId, (int) $lineId, $qty);
        return $ok ? ['ok' => true] : [['error' => 'Not found'], 404];
    }

    public function updateServiceLine(Request $req, $woId, $lineId): array
    {
        $qty = (int) ($req->body['quantity'] ?? 0);
        if ($qty <= 0)
            return [['error' => 'quantity must be > 0'], 422];

        $ok = $this->woRepo->updateServiceLine((int) $woId, (int) $lineId, $qty);
        return $ok ? ['ok' => true] : [['error' => 'Not found'], 404];
    }

    public function get(Request $req, $id): array
    {
        $wo = $this->woRepo->getById((int) $id);
        if (!$wo)
            return [['error' => 'Not found'], 404];

        $lines = $this->woRepo->getLines((int) $id);
        $services = $lines['services'];
        $partsLines = $lines['parts'];

        $labor = 0;
        foreach ($services as $line) {
            $qty = (int) ($line['quantity'] ?? 1);
            $price = (float) ($line['price'] ?? 0);
            $labor += $qty * $price;
        }
        $partsTotal = 0;
        foreach ($partsLines as $line) {
            $qty = (int) ($line['quantity'] ?? 1);
            $price = (float) ($line['unit_price'] ?? 0);
            $partsTotal += $qty * $price;
        }
        $totals = [
            'labor_subtotal' => $labor,
            'parts_subtotal' => $partsTotal,
            'total' => $labor + $partsTotal,
        ];

        // Merge into single object for frontend
        $wo['services'] = $services;
        $wo['items'] = $partsLines;
        $wo['totals'] = $totals;

        return $wo;
    }

    public function updateStatus(Request $req, $id): array
    {
        $next = (string) ($req->body['status'] ?? '');
        if ($next === '')
            return [['error' => 'status required'], 422];

        try {
            $row = $this->woRepo->updateStatus((int) $id, $next);
            return $row ?: [['error' => 'Not found'], 404];
        } catch (\DomainException $e) {
            return [['error' => $e->getMessage()], 409];
        }
    }

    public function list(Request $req): array
    {
        $page = max(1, (int) ($req->query['page'] ?? 1));
        $size = min(200, max(1, (int) ($req->query['size'] ?? 50)));

        $items = $this->woRepo->list($req->query, $page, $size);
        return ['items' => $items, 'page' => $page, 'size' => $size];
    }

    public function update(Request $req, $id): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $id = (int) $id;
            $b = $req->body ?? [];

            $st = $pdo->prepare('SELECT customer_id, bike_id FROM work_orders WHERE id = ? FOR UPDATE');
            $st->execute([$id]);
            $current = $st->fetch();
            if (!$current) {
                $pdo->rollBack();
                return [['error' => 'Not found'], 404];
            }

            $customerId = isset($b['customer_id']) ? (int) $b['customer_id'] : (int) $current['customer_id'];
            $bikeId = isset($b['bike_id']) && $b['bike_id'] !== null && $b['bike_id'] !== ''
                ? (int) $b['bike_id']
                : (int) ($current['bike_id'] ?? 0);

            // Handle bike data
            if (isset($b['bike']) && is_array($b['bike'])) {
                $bike = $b['bike'];
                $targetBikeId = isset($bike['id']) ? (int) $bike['id'] : ($bikeId ?: 0);
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
                    $bikeId = (int) $upd->fetchColumn();
                } else {
                    // Create new bike
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
                    $bikeId = (int) $ins->fetchColumn();
                }
            }

            // Update WO fields using repository
            $updateData = [
                'customer_id' => $customerId,
                'bike_id' => $bikeId ?: null
            ];
            if (array_key_exists('assigned_to', $b))
                $updateData['assigned_to'] = $b['assigned_to'] !== '' ? $b['assigned_to'] : null;
            if (array_key_exists('promised_at', $b))
                $updateData['promised_at'] = $b['promised_at'];
            if (array_key_exists('notes', $b))
                $updateData['notes'] = $b['notes'];

            $this->woRepo->update($id, $updateData);

            // Optional status update
            if (isset($b['status']) && $b['status'] !== '') {
                $this->woRepo->updateStatus($id, $b['status']);
            }

            $pdo->commit();
            return ['id' => $id, 'ok' => true];
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
