DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'bike_shop') THEN
        EXECUTE 'CREATE SCHEMA bike_shop';
    END IF;
END$$;

SET search_path TO bike_shop, public;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','manager','sales','mechanic')),
    is_active BOOLEAN DEFAULT TRUE,
    password_hash TEXT NOT NULL,
    pin_code CHAR(4) UNIQUE
);

INSERT INTO users (email, full_name, role, is_active, password_hash)
VALUES
    ('owner@bluespoke.test', 'Owner One', 'owner', TRUE, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '1001'),
    ('manager@bluespoke.test', 'Manager Mary', 'manager', TRUE, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '2002'),
    ('mechanic@bluespoke.test', 'Mechanic Max', 'mechanic', TRUE, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '3003')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    street TEXT,
    city TEXT,
    region TEXT,
    postal_code TEXT,
    country TEXT,
    notes TEXT
);

INSERT INTO customers (first_name,last_name,email,phone,city,region,country)
VALUES
    ('Ava','Rider','ava@example.com','555-0101','Portland','OR','USA'),
    ('Ben','Tourer','ben@example.com','555-0102','Seattle','WA','USA'),
    ('Chloe','Sprinter','chloe@example.com','555-0103','Boise','ID','USA')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);
INSERT INTO brands (name) VALUES ('Blue Spoke'), ('Futurist Cycles'), ('Everyday Bikes')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);
INSERT INTO categories (name) VALUES ('Frames'), ('Wheels'), ('Accessories')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand_id INT REFERENCES brands(id),
    category_id INT REFERENCES categories(id),
    is_serialized BOOLEAN DEFAULT FALSE,
    cost NUMERIC(10,2) DEFAULT 0,
    price NUMERIC(10,2) DEFAULT 0,
    reorder_level INT DEFAULT 0
);

INSERT INTO inventory_items (sku,name,brand_id,category_id,is_serialized,cost,price,reorder_level)
VALUES
    ('BK-001','All-road Frame',1,1,FALSE,450,799,5),
    ('WH-002','29er Wheelset',2,2,FALSE,180,349,4),
    ('AC-003','Pro Tune Kit',3,3,FALSE,30,69,10)
ON CONFLICT (sku) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_bikes (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    brand TEXT,
    model TEXT,
    model_year INT,
    serial_number TEXT,
    color TEXT,
    wheel_size TEXT,
    drivetrain TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS services_catalog (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    default_minutes INT DEFAULT 60,
    default_price NUMERIC(10,2) DEFAULT 80
);

INSERT INTO services_catalog (code,name,default_minutes,default_price)
VALUES
    ('TUNE_BASIC','Basic Tune',60,85),
    ('TUNE_PRO','Pro Tune',90,140),
    ('WHEEL_TRU','Wheel Truing',45,60)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'open',
    customer_id INT REFERENCES customers(id),
    bike_id INT REFERENCES customer_bikes(id),
    opened_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    opened_by INT REFERENCES users(id),
    assigned_to INT REFERENCES users(id),
    promised_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    closed_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS work_order_service_lines (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    service_id INT REFERENCES services_catalog(id),
    quantity INT DEFAULT 1,
    minutes INT,
    price NUMERIC(10,2),
    assigned_to INT REFERENCES users(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS work_order_part_lines (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    item_id INT REFERENCES inventory_items(id),
    quantity INT DEFAULT 1,
    unit_price NUMERIC(10,2),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS work_order_appointments (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    assigned_to INT REFERENCES users(id),
    location_id INT,
    status TEXT DEFAULT 'scheduled',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS time_clock_entries (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    clock_in TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    clock_out TIMESTAMP WITHOUT TIME ZONE,
    note TEXT
);

CREATE TABLE IF NOT EXISTS warranties (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    brand_id INT REFERENCES brands(id),
    item_id INT REFERENCES inventory_items(id),
    duration_months INT DEFAULT 12,
    terms TEXT
);

CREATE TABLE IF NOT EXISTS customer_warranties (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    bike_id INT REFERENCES customer_bikes(id),
    inventory_item_id INT REFERENCES inventory_items(id),
    serial_number TEXT,
    warranty_id INT REFERENCES warranties(id),
    status TEXT DEFAULT 'active',
    purchase_date DATE,
    start_date DATE,
    duration_months INT,
    notes TEXT
);

INSERT INTO warranties (name, duration_months, terms)
VALUES ('Frame Confidence', 24, 'Covers manufacturing defects'), ('WheelCare', 12, 'Spoke & rim issues')
ON CONFLICT DO NOTHING;

-- Seed a demo work order
INSERT INTO work_orders (status, customer_id, opened_by, assigned_to, notes)
SELECT 'open', c.id, owner.id, mech.id, 'Initial tune-up'
FROM customers c
JOIN users owner ON owner.role = 'owner'
LEFT JOIN LATERAL (SELECT id FROM users WHERE role = 'mechanic' LIMIT 1) AS mech ON TRUE
WHERE c.id = 1
  AND NOT EXISTS (SELECT 1 FROM work_orders);

INSERT INTO work_order_service_lines (work_order_id, service_id, quantity, minutes, price, assigned_to)
SELECT w.id, s.id, 1, s.default_minutes, s.default_price, w.assigned_to
FROM work_orders w
JOIN services_catalog s ON s.code = 'TUNE_BASIC'
WHERE w.id = (SELECT min(id) FROM work_orders)
  AND NOT EXISTS (SELECT 1 FROM work_order_service_lines);

INSERT INTO work_order_part_lines (work_order_id, item_id, quantity, unit_price)
SELECT w.id, i.id, 1, i.price
FROM inventory_items i
JOIN (SELECT min(id) AS id FROM work_orders) w(id) ON TRUE
WHERE i.sku = 'AC-003'
  AND NOT EXISTS (SELECT 1 FROM work_order_part_lines);

INSERT INTO work_order_appointments (work_order_id,start_at,end_at,assigned_to,status,notes)
SELECT w.id, now() + interval '1 day', now() + interval '1 day' + interval '2 hours', w.assigned_to, 'scheduled', 'Demo appointment'
FROM (SELECT min(id) AS id, max(assigned_to) AS assigned_to FROM work_orders) w
WHERE NOT EXISTS (SELECT 1 FROM work_order_appointments);

INSERT INTO customer_warranties (customer_id, warranty_id, status, purchase_date, start_date, duration_months)
SELECT 1, 1, 'active', current_date - 30, current_date - 30, 24
WHERE NOT EXISTS (SELECT 1 FROM customer_warranties WHERE customer_id = 1 AND warranty_id = 1);
