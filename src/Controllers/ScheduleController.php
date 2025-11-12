<?php
namespace App\Controllers;
use App\Http\Request;
use App\Database;
use DateTimeImmutable;
use PDOException;
use Throwable;

final class ScheduleController
{
    public function create(Request $req, $woId): array
    {
        $b = $req->body; $pdo = Database::pdo();
        $st = $pdo->prepare('INSERT INTO work_order_appointments (work_order_id, start_at, end_at, assigned_to, location_id, status, notes)
            VALUES (:wo,:start_at,:end_at,:assigned_to,:location_id,:status,:notes) RETURNING id');
        try {
            $st->execute([
                ':wo'=>(int)$woId,
                ':start_at'=>$b['start_at'], ':end_at'=>$b['end_at'],
                ':assigned_to'=>$b['assigned_to'] ?? null,
                ':location_id'=>$b['location_id'] ?? null,
                ':status'=>$b['status'] ?? 'scheduled',
                ':notes'=>$b['notes'] ?? null,
            ]);
        } catch (PDOException $e) {
            $errorInfo = $st->errorInfo();
            $sqlState = $errorInfo[0] ?? $e->getCode();
            if ($sqlState === '23P01' || $sqlState === '23505') return [['error'=>'Overlapping appointment'], 409];
            throw $e;
        }
        return ['id' => (int)$st->fetchColumn()];
    }

    public function nextSlot(Request $req): array
    {
        $q = $req->query;
        $mechanic   = (int)($q['mechanic_id'] ?? 0) ?: null;
        $location   = (int)($q['location_id'] ?? 0) ?: null;
        $duration   = max(15, (int)($q['duration_minutes'] ?? 60));
        $fromParam  = $q['from'] ?? null;
        $from       = $fromParam ? new DateTimeImmutable($fromParam) : new DateTimeImmutable();

        try {
            $sql = "SELECT start_at, end_at FROM bike_shop.find_next_slot(:mech, :loc, :dur, COALESCE(:from, now()))";
            $st  = Database::pdo()->prepare($sql);
            $st->execute([
                ':mech' => $mechanic,
                ':loc'  => $location,
                ':dur'  => $duration,
                ':from' => $fromParam,
            ]);
            $row = $st->fetch();
            if ($row) return $row;
        } catch (Throwable $e) {
            // fall through to simple heuristic fallback
        }

        return $this->fallbackSlot($mechanic, $duration, $from);
    }

    public function nextSlotForWorkOrder(Request $req, $woId): array
    {
        $fromParam = $req->query['from'] ?? null;
        try {
            $sql  = "SELECT start_at, end_at FROM bike_shop.find_next_slot_for_wo(:wo, COALESCE(:from, now()))";
            $st   = Database::pdo()->prepare($sql);
            $st->execute([':wo' => (int)$woId, ':from' => $fromParam]);
            $row = $st->fetch();
            if ($row) return $row;
        } catch (Throwable $e) {
            // fallback handled below
        }
        return $this->nextSlot($req);
    }

    public function mechanicDay(Request $req): array
    {
        $mechanicId = (int)($req->query['mechanic_id'] ?? 0);
        $day        = $req->query['day'] ?? (new DateTimeImmutable('today'))->format('Y-m-d');

        if ($mechanicId <= 0) return [['error' => 'mechanic_id required'], 422];
        try {
            $sql = "SELECT * FROM bike_shop.v_mechanic_day_schedule
                    WHERE mechanic = (SELECT full_name FROM bike_shop.users WHERE id = :uid)
                      AND date_trunc('day', start_at) = :day::date
                    ORDER BY start_at";
            $st = Database::pdo()->prepare($sql);
            $st->execute([':uid' => $mechanicId, ':day' => $day]);
            return ['day' => $day, 'appointments' => $st->fetchAll()];
        } catch (Throwable $e) {
            $sql = "SELECT a.id, a.start_at, a.end_at, a.status, a.notes, a.work_order_id,
                           u.full_name AS mechanic
                    FROM work_order_appointments a
                    LEFT JOIN users u ON u.id = a.assigned_to
                    WHERE a.assigned_to = :uid
                      AND date_trunc('day', a.start_at) = :day::date
                    ORDER BY a.start_at";
            $st = Database::pdo()->prepare($sql);
            $st->execute([':uid' => $mechanicId, ':day' => $day]);
            return ['day' => $day, 'appointments' => $st->fetchAll()];
        }
    }

    private function fallbackSlot(?int $mechanic, int $duration, DateTimeImmutable $from): array
    {
        $pdo = Database::pdo();
        $sql = "SELECT end_at FROM work_order_appointments
                WHERE (:mechanic IS NULL OR assigned_to = :mechanic)
                  AND start_at >= :from
                ORDER BY start_at LIMIT 1";
        $st = $pdo->prepare($sql);
        $st->execute([
            ':mechanic' => $mechanic,
            ':from' => $from->format('Y-m-d H:i:s'),
        ]);
        $busy = $st->fetch();
        $start = $busy ? new DateTimeImmutable($busy['end_at']) : $from;
        $end = $start->modify("+$duration minutes");
        return [
            'start_at' => $start->format(DATE_ATOM),
            'end_at' => $end->format(DATE_ATOM),
        ];
    }
}
