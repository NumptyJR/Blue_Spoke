<?php
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
            ':name'=>$b['name'], ':brand_id'=>$b['brand_id']??null, ':item_id'=>$b['item_id']??null,
            ':dur'=>$b['duration_months'] ?? 12, ':terms'=>$b['terms']??null
        ]);
        return ['id'=>(int)$st->fetchColumn()];
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
            ':cid'=>(int)$customerId,
            ':bike_id'=>$b['bike_id']??null,
            ':item_id'=>$b['inventory_item_id']??null,
            ':serial'=>$b['serial_number']??null,
            ':wid'=>(int)$b['warranty_id'],
            ':status'=>$b['status'] ?? 'active',
            ':pdate'=>$b['purchase_date'] ?? date('Y-m-d'),
            ':sdate'=>$b['start_date'] ?? date('Y-m-d'),
            ':duration'=>$b['duration_months'] ?? null,
            ':notes'=>$b['notes']??null,
        ]);
        return ['id'=>(int)$st->fetchColumn()];
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
        $st->execute([(int)$customerId]);
        return $st->fetchAll();
    }
}
