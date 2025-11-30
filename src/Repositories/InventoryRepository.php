<?php
namespace App\Repositories;

use App\Database;
use PDO;

class InventoryRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::pdo();
    }

    public function findItemById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM inventory_items WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $item = $stmt->fetch();
        return $item ?: null;
    }

    public function findServiceById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM services_catalog WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $service = $stmt->fetch();
        return $service ?: null;
    }

    public function findServiceByCode(string $code): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM services_catalog WHERE code = :code');
        $stmt->execute([':code' => $code]);
        $service = $stmt->fetch();
        return $service ?: null;
    }
}
