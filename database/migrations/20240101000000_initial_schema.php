<?php
//Author: Joshua Schaff
//email: joshuarschaff@gmail.com
//Description: This file creates the initial schema for the bike shop database.
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class InitialSchema extends AbstractMigration
{
    public function up(): void
    {
        $sql = <<<'SQL'
CREATE SCHEMA IF NOT EXISTS bike_shop;
SET search_path TO bike_shop, public;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner','manager','sales','mechanic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE work_order_status AS ENUM (
        'draft','open','in_progress','paused','awaiting_parts','completed','delivered','cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_txn_type AS ENUM (
        'purchase','adjustment_in','adjustment_out','sale','work_order_use','return_to_stock','transfer_in','transfer_out'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE warranty_status AS ENUM ('active','expired','void','transferred');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('scheduled','confirmed','in_service','done','no_show','cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_component_brand BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email public.citext NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    hired_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    password_hash TEXT,
    pin_code CHAR(4) UNIQUE
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS users_pin_code_idx ON users(pin_code);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email public.CITEXT,
    phone TEXT,
    street TEXT,
    city TEXT,
    region TEXT,
    postal_code TEXT,
    country TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);

CREATE TABLE IF NOT EXISTS customer_bikes (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT,
    model_year INT,
    serial_number TEXT,
    color TEXT,
    wheel_size TEXT,
    drivetrain TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_bikes_customer_idx ON customer_bikes(customer_id);
CREATE INDEX IF NOT EXISTS customer_bikes_serial_idx ON customer_bikes(serial_number);

CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    is_serialized BOOLEAN NOT NULL DEFAULT FALSE,
    cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS inventory_items_set_updated_at ON inventory_items;
CREATE TRIGGER inventory_items_set_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS inventory_items_brand_idx ON inventory_items(brand_id);
CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON inventory_items(category_id);

CREATE TABLE IF NOT EXISTS inventory_stock (
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    PRIMARY KEY (location_id, item_id)
);

CREATE TABLE IF NOT EXISTS inventory_serials (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(item_id, serial_number)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    txn_type inventory_txn_type NOT NULL,
    quantity INT NOT NULL,
    reference TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_tx_item_loc_idx ON inventory_transactions(item_id, location_id);
CREATE INDEX IF NOT EXISTS inventory_tx_type_idx ON inventory_transactions(txn_type);

CREATE TABLE IF NOT EXISTS services_catalog (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    default_minutes INT NOT NULL DEFAULT 30,
    default_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS work_orders (
    id BIGSERIAL PRIMARY KEY,
    status work_order_status NOT NULL DEFAULT 'draft',
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    bike_id BIGINT REFERENCES customer_bikes(id) ON DELETE SET NULL,
    opened_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    promised_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    notes TEXT,
    location_id BIGINT REFERENCES locations(id)
);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders(status);
CREATE INDEX IF NOT EXISTS work_orders_customer_idx ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS work_orders_assigned_idx ON work_orders(assigned_to);

CREATE TABLE IF NOT EXISTS work_order_service_lines (
    id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES services_catalog(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1,
    minutes INT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS wo_service_lines_wo_idx ON work_order_service_lines(work_order_id);

CREATE TABLE IF NOT EXISTS work_order_part_lines (
    id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS wo_part_lines_wo_idx ON work_order_part_lines(work_order_id);
CREATE INDEX IF NOT EXISTS wo_part_lines_item_idx ON work_order_part_lines(item_id);

CREATE OR REPLACE VIEW v_work_order_totals AS
SELECT wo.id AS work_order_id,
       COALESCE(SUM(sl.price * sl.quantity), 0)::NUMERIC(12,2) AS labor_subtotal,
       COALESCE(SUM(pl.unit_price * pl.quantity), 0)::NUMERIC(12,2) AS parts_subtotal,
       (COALESCE(SUM(sl.price * sl.quantity), 0) + COALESCE(SUM(pl.unit_price * pl.quantity), 0))::NUMERIC(12,2) AS total
FROM work_orders wo
         LEFT JOIN work_order_service_lines sl ON sl.work_order_id = wo.id
         LEFT JOIN work_order_part_lines pl ON pl.work_order_id = wo.id
GROUP BY wo.id;

CREATE TABLE IF NOT EXISTS time_clock_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    note TEXT,
    duration_minutes INT GENERATED ALWAYS AS (
        CASE WHEN clock_out IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60.0)::INT END
    ) STORED,
    CHECK (clock_out IS NULL OR clock_out > clock_in)
);
CREATE INDEX IF NOT EXISTS time_clock_user_idx ON time_clock_entries(user_id, clock_in DESC);

CREATE TABLE IF NOT EXISTS warranties (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    item_id BIGINT REFERENCES inventory_items(id) ON DELETE SET NULL,
    duration_months INT NOT NULL DEFAULT 12,
    terms TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_warranties (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    bike_id BIGINT REFERENCES customer_bikes(id) ON DELETE SET NULL,
    inventory_item_id BIGINT REFERENCES inventory_items(id) ON DELETE SET NULL,
    serial_number TEXT,
    warranty_id BIGINT NOT NULL REFERENCES warranties(id) ON DELETE RESTRICT,
    status warranty_status NOT NULL DEFAULT 'active',
    purchase_date DATE NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_months INT NOT NULL,
    end_date DATE GENERATED ALWAYS AS (start_date + make_interval(months => duration_months)) STORED,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS customer_warranties_customer_idx ON customer_warranties(customer_id);
CREATE INDEX IF NOT EXISTS customer_warranties_serial_idx ON customer_warranties(serial_number);

CREATE OR REPLACE VIEW v_inventory_on_hand AS
SELECT i.id AS item_id, i.sku, i.name, b.name AS brand, c.name AS category,
       SUM(s.quantity_on_hand) AS qty_on_hand,
       i.price
FROM inventory_items i
         LEFT JOIN brands b ON b.id = i.brand_id
         LEFT JOIN categories c ON c.id = i.category_id
         LEFT JOIN inventory_stock s ON s.item_id = i.id
GROUP BY i.id, i.sku, i.name, b.name, c.name, i.price;

CREATE OR REPLACE VIEW v_active_work_orders AS
SELECT wo.id, wo.status, wo.opened_at,
       c.first_name || ' ' || c.last_name AS customer,
       cb.brand || ' ' || COALESCE(cb.model,'') AS bike,
       u.full_name AS assigned_to,
       t.total
FROM work_orders wo
         JOIN customers c ON c.id = wo.customer_id
         LEFT JOIN customer_bikes cb ON cb.id = wo.bike_id
         LEFT JOIN users u ON u.id = wo.assigned_to
         LEFT JOIN v_work_order_totals t ON t.work_order_id = wo.id
WHERE wo.status IN ('open','in_progress','paused','awaiting_parts');

CREATE TABLE IF NOT EXISTS work_order_appointments (
    id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS wo_appt_wo_idx ON work_order_appointments(work_order_id);
CREATE INDEX IF NOT EXISTS wo_appt_time_idx ON work_order_appointments(start_at, end_at);
CREATE INDEX IF NOT EXISTS wo_appt_assigned_idx ON work_order_appointments(assigned_to);

CREATE OR REPLACE VIEW v_work_order_suggested_minutes AS
SELECT wo.id AS work_order_id,
       COALESCE(SUM(sl.minutes * sl.quantity), 0) AS suggested_minutes
FROM work_orders wo
         LEFT JOIN work_order_service_lines sl ON sl.work_order_id = wo.id
GROUP BY wo.id;

CREATE OR REPLACE VIEW v_mechanic_day_schedule AS
SELECT
    u.full_name AS mechanic,
    date_trunc('day', a.start_at) AS day,
    a.start_at, a.end_at,
    (EXTRACT(EPOCH FROM (a.end_at - a.start_at)) / 60)::INT AS minutes_booked,
    a.status,
    wo.id AS work_order_id,
    c.first_name || ' ' || c.last_name AS customer,
    cb.brand || ' ' || COALESCE(cb.model,'') AS bike,
    a.location_id
FROM work_order_appointments a
         LEFT JOIN work_orders wo ON wo.id = a.work_order_id
         LEFT JOIN users u ON u.id = a.assigned_to
         LEFT JOIN customers c ON c.id = wo.customer_id
         LEFT JOIN customer_bikes cb ON cb.id = wo.bike_id;

DROP TRIGGER IF EXISTS trg_wo_part_ins_consume ON work_order_part_lines;
DROP TRIGGER IF EXISTS trg_wo_part_upd_adjust ON work_order_part_lines;
DROP TRIGGER IF EXISTS trg_wo_part_del_revert ON work_order_part_lines;
DROP FUNCTION IF EXISTS bike_shop.wo_part_ins_consume();
DROP FUNCTION IF EXISTS bike_shop.wo_part_upd_adjust();
DROP FUNCTION IF EXISTS bike_shop.wo_part_del_revert();

CREATE OR REPLACE FUNCTION bike_shop.wo_part_ins_consume()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc BIGINT;
BEGIN
    SELECT location_id INTO loc FROM bike_shop.work_orders WHERE id = NEW.work_order_id;
    INSERT INTO bike_shop.inventory_transactions(item_id, location_id, txn_type, quantity, reference, created_by)
    VALUES (NEW.item_id, loc, 'work_order_use', -NEW.quantity, CONCAT('WO#', NEW.work_order_id), NULL);
    UPDATE bike_shop.inventory_stock
    SET quantity_on_hand = quantity_on_hand - NEW.quantity
    WHERE location_id = loc AND item_id = NEW.item_id;
    IF NOT FOUND THEN
        INSERT INTO bike_shop.inventory_stock(location_id, item_id, quantity_on_hand)
        VALUES (loc, NEW.item_id, -NEW.quantity);
    END IF;
    RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION bike_shop.wo_part_upd_adjust()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc BIGINT; delta INT;
BEGIN
    SELECT location_id INTO loc FROM bike_shop.work_orders WHERE id = NEW.work_order_id;
    delta := NEW.quantity - OLD.quantity;
    IF delta = 0 THEN
        RETURN NEW;
    ELSIF delta > 0 THEN
        INSERT INTO bike_shop.inventory_transactions(item_id, location_id, txn_type, quantity, reference, created_by)
        VALUES (NEW.item_id, loc, 'work_order_use', -delta, CONCAT('WO#', NEW.work_order_id), NULL);
        UPDATE bike_shop.inventory_stock
        SET quantity_on_hand = quantity_on_hand - delta
        WHERE location_id = loc AND item_id = NEW.item_id;
        IF NOT FOUND THEN
            INSERT INTO bike_shop.inventory_stock(location_id, item_id, quantity_on_hand)
            VALUES (loc, NEW.item_id, -delta);
        END IF;
    ELSE
        INSERT INTO bike_shop.inventory_transactions(item_id, location_id, txn_type, quantity, reference, created_by)
        VALUES (NEW.item_id, loc, 'return_to_stock', -delta, CONCAT('WO#', NEW.work_order_id), NULL);
        UPDATE bike_shop.inventory_stock
        SET quantity_on_hand = quantity_on_hand + (-delta)
        WHERE location_id = loc AND item_id = NEW.item_id;
        IF NOT FOUND THEN
            INSERT INTO bike_shop.inventory_stock(location_id, item_id, quantity_on_hand)
            VALUES (loc, NEW.item_id, -delta);
        END IF;
    END IF;
    RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION bike_shop.wo_part_del_revert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc BIGINT;
BEGIN
    SELECT location_id INTO loc FROM bike_shop.work_orders WHERE id = OLD.work_order_id;
    INSERT INTO bike_shop.inventory_transactions(item_id, location_id, txn_type, quantity, reference, created_by)
    VALUES (OLD.item_id, loc, 'return_to_stock', OLD.quantity, CONCAT('WO#', OLD.work_order_id), NULL);
    UPDATE bike_shop.inventory_stock
    SET quantity_on_hand = quantity_on_hand + OLD.quantity
    WHERE location_id = loc AND item_id = OLD.item_id;
    IF NOT FOUND THEN
        INSERT INTO bike_shop.inventory_stock(location_id, item_id, quantity_on_hand)
        VALUES (loc, OLD.item_id, OLD.quantity);
    END IF;
    RETURN OLD;
END$$;

CREATE TRIGGER trg_wo_part_ins_consume
    AFTER INSERT ON work_order_part_lines
    FOR EACH ROW EXECUTE FUNCTION bike_shop.wo_part_ins_consume();

CREATE TRIGGER trg_wo_part_upd_adjust
    AFTER UPDATE OF quantity, item_id, work_order_id ON work_order_part_lines
    FOR EACH ROW EXECUTE FUNCTION bike_shop.wo_part_upd_adjust();

CREATE TRIGGER trg_wo_part_del_revert
    AFTER DELETE ON work_order_part_lines
    FOR EACH ROW EXECUTE FUNCTION bike_shop.wo_part_del_revert();

CREATE TABLE IF NOT EXISTS business_hours (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    dow SMALLINT NOT NULL CHECK (dow BETWEEN 0 AND 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    CHECK (close_time > open_time),
    UNIQUE(location_id, dow)
);

CREATE TABLE IF NOT EXISTS closures (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    CHECK (ends_at > starts_at)
);

CREATE OR REPLACE FUNCTION bike_shop.is_slot_allowed(_loc BIGINT, _start TIMESTAMPTZ, _end TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
WITH hours AS (
    SELECT open_time, close_time
    FROM bike_shop.business_hours
    WHERE location_id = _loc
      AND dow = EXTRACT(DOW FROM _start)::INT
),
     ok_hours AS (
         SELECT 1
         FROM hours
         WHERE (_start::time >= open_time)
           AND (_end::time <= close_time)
           AND (EXTRACT(DOW FROM _start) = EXTRACT(DOW FROM _end))
     ),
     clash AS (
         SELECT 1 FROM bike_shop.closures c
         WHERE c.location_id = _loc
           AND tstzrange(c.starts_at, c.ends_at, '[)') &&
               tstzrange(_start, _end, '[)')
         LIMIT 1
     )
SELECT EXISTS(SELECT 1 FROM ok_hours) AND NOT EXISTS(SELECT 1 FROM clash);
$$;

CREATE OR REPLACE FUNCTION bike_shop.validate_appointment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.location_id IS NULL THEN
        NEW.location_id := (SELECT location_id FROM bike_shop.work_orders WHERE id = NEW.work_order_id);
    END IF;
    IF NOT bike_shop.is_slot_allowed(NEW.location_id, NEW.start_at, NEW.end_at) THEN
        RAISE EXCEPTION 'Appointment outside business hours or during closure' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_validate_appointment ON work_order_appointments;
CREATE TRIGGER trg_validate_appointment
    BEFORE INSERT OR UPDATE ON work_order_appointments
    FOR EACH ROW EXECUTE FUNCTION bike_shop.validate_appointment();

INSERT INTO business_hours(location_id,dow,open_time,close_time)
SELECT l.id, d, '10:00','18:00'
FROM locations l CROSS JOIN generate_series(1,6) d
ON CONFLICT (location_id, dow) DO NOTHING;

CREATE OR REPLACE FUNCTION bike_shop.find_next_slot(
    _mechanic BIGINT,
    _location BIGINT,
    _duration_minutes INT,
    _from TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
WITH grid AS (
    SELECT gs AS slot_start,
            gs + make_interval(mins => _duration_minutes) AS slot_end
    FROM generate_series(_from, _from + interval '14 days', interval '15 minutes') gs
),
        allowed AS (
            SELECT slot_start, slot_end
            FROM grid
            WHERE bike_shop.is_slot_allowed(_location, slot_start, slot_end)
        ),
        no_mech_overlap AS (
            SELECT a.slot_start, a.slot_end
            FROM allowed a
                    LEFT JOIN bike_shop.work_order_appointments w
                    ON w.assigned_to = _mechanic
                    AND w.status IN ('scheduled','confirmed','in_service')
                    AND tstzrange(w.start_at, w.end_at, '[)') && tstzrange(a.slot_start, a.slot_end, '[)')
            WHERE w.id IS NULL
        )
SELECT slot_start AS start_at, slot_end AS end_at
FROM no_mech_overlap
ORDER BY slot_start
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION bike_shop.find_next_slot_for_wo(
    _work_order_id BIGINT,
    _from TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
WITH inputs AS (
    SELECT wo.assigned_to AS mechanic_id,
            wo.location_id AS location_id,
            GREATEST(15, COALESCE(s.suggested_minutes, 30))::INT AS minutes_needed
    FROM bike_shop.work_orders wo
                LEFT JOIN bike_shop.v_work_order_suggested_minutes s ON s.work_order_id = wo.id
    WHERE wo.id = _work_order_id
)
SELECT * FROM bike_shop.find_next_slot(
    (SELECT mechanic_id FROM inputs),
    (SELECT location_id FROM inputs),
    (SELECT minutes_needed FROM inputs),
    _from
);
$$;

CREATE OR REPLACE FUNCTION bike_shop.work_order_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN := FALSE;
BEGIN
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;
    CASE OLD.status
        WHEN 'draft'        THEN ok := NEW.status IN ('open','cancelled');
        WHEN 'open'         THEN ok := NEW.status IN ('in_progress','awaiting_parts','paused','cancelled');
        WHEN 'in_progress'  THEN ok := NEW.status IN ('paused','awaiting_parts','completed');
        WHEN 'paused'       THEN ok := NEW.status IN ('in_progress','cancelled');
        WHEN 'awaiting_parts' THEN ok := NEW.status IN ('in_progress','paused','cancelled');
        WHEN 'completed'    THEN ok := NEW.status IN ('delivered');
        ELSE ok := FALSE;
    END CASE;
    IF NOT ok THEN
        RAISE EXCEPTION 'Illegal status transition: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('completed','delivered') AND OLD.closed_at IS NULL THEN
        NEW.closed_at := now();
    END IF;
    RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_wo_status_guard ON work_orders;
CREATE TRIGGER trg_wo_status_guard
    BEFORE UPDATE OF status ON work_orders
    FOR EACH ROW EXECUTE FUNCTION bike_shop.work_order_status_guard();
SQL;
        $this->execute($sql);
    }
}
