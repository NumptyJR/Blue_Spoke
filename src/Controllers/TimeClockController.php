<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: TimeClockController.php
// Description: Time clock controller

namespace App\Controllers;
use App\Http\Request;
use App\Database;
use DateTimeImmutable;

final class TimeClockController
{
    public function clockIn(Request $req): array
    {
        $pdo = Database::pdo();
        $user = $this->userFromCode($req, $pdo);
        if (array_is_list($user)) {
            return $user;
        }
        $userRow = $user;

        $chk = $pdo->prepare('SELECT id FROM time_clock_entries WHERE user_id = ? AND clock_out IS NULL');
        $chk->execute([(int) $userRow['id']]);
        if ($chk->fetch())
            return [['error' => "{$userRow['full_name']} is already clocked in"], 409];

        $st = $pdo->prepare('INSERT INTO time_clock_entries (user_id, clock_in, note) VALUES (?, now(), ?) RETURNING id');
        $st->execute([(int) $userRow['id'], $req->body['note'] ?? null]);
        return ['id' => (int) $st->fetchColumn(), 'user' => $userRow];
    }

    public function clockOut(Request $req): array
    {
        $pdo = Database::pdo();
        $user = $this->userFromCode($req, $pdo);
        if (array_is_list($user)) {
            return $user;
        }
        $userRow = $user;

        $st = $pdo->prepare('UPDATE time_clock_entries SET clock_out = now() WHERE user_id = ? AND clock_out IS NULL RETURNING id');
        $st->execute([(int) $userRow['id']]);
        $id = $st->fetchColumn();
        return $id ? ['id' => (int) $id, 'user' => $userRow] : [['error' => "{$userRow['full_name']} is not clocked in"], 409];
    }

    public function status(Request $req): array
    {
        $pdo = Database::pdo();
        $sql = "SELECT u.id, u.full_name, u.role,
                       entry.id AS entry_id, entry.clock_in, entry.clock_out
                FROM bike_shop.users u
                LEFT JOIN LATERAL (
                    SELECT id, clock_in, clock_out
                    FROM bike_shop.time_clock_entries
                    WHERE user_id = u.id
                    ORDER BY clock_in DESC
                    LIMIT 1
                ) entry ON true
                WHERE u.is_active = TRUE
                ORDER BY u.full_name";
        $rows = $pdo->query($sql)->fetchAll();
        $now = new DateTimeImmutable();
        $people = [];
        foreach ($rows as $row) {
            $clockIn = $row['clock_in'] ? new DateTimeImmutable($row['clock_in']) : null;
            $clockOut = $row['clock_out'] ? new DateTimeImmutable($row['clock_out']) : null;
            $isClockedIn = $clockIn && !$clockOut;
            $minutesActive = null;
            if ($isClockedIn) {
                $minutesActive = (int) floor(($now->getTimestamp() - $clockIn->getTimestamp()) / 60);
            }
            $people[] = [
                'id' => (int) $row['id'],
                'full_name' => $row['full_name'],
                'role' => $row['role'],
                'clock_in' => $clockIn?->format(DATE_ATOM),
                'clock_out' => $clockOut?->format(DATE_ATOM),
                'is_clocked_in' => $isClockedIn,
                'minutes_active' => $minutesActive,
            ];
        }
        return ['people' => $people];
    }

    private function userFromCode(Request $req, $pdo)
    {
        $code = (string) ($req->body['code'] ?? $req->query['code'] ?? '');
        $code = trim($code);
        if (!preg_match('/^\d{4}$/', $code)) {
            return [['error' => 'A 4-digit code is required'], 422];
        }
        $st = $pdo->prepare('SELECT id, full_name, role FROM bike_shop.users WHERE pin_code = :code AND is_active = TRUE');
        $st->execute([':code' => $code]);
        $user = $st->fetch();
        if (!$user)
            return [['error' => 'Invalid code'], 404];
        return $user;
    }
}
