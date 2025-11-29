<?php
namespace App\Repositories;

use App\Database;
use PDO;

class UserRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::pdo();
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, email, full_name, role, is_active, password_hash FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare('INSERT INTO users (email, full_name, role, is_active, password_hash)
            VALUES (:email, :full_name, :role, TRUE, :ph) RETURNING id');
        $stmt->execute([
            ':email' => $data['email'],
            ':full_name' => $data['full_name'],
            ':role' => $data['role'],
            ':ph' => $data['password_hash']
        ]);
        return (int) $stmt->fetchColumn();
    }

    public function updatePassword(int $userId, string $hash): ?int
    {
        $stmt = $this->pdo->prepare('UPDATE users SET password_hash = :ph WHERE id = :id RETURNING id');
        $stmt->execute([':ph' => $hash, ':id' => $userId]);
        $id = $stmt->fetchColumn();
        return $id ? (int) $id : null;
    }
}
