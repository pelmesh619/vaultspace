CREATE TABLE vault (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    occupants INTEGER NOT NULL CHECK (occupants >= 0),
    security_level SMALLINT NOT NULL CHECK (security_level BETWEEN 0 AND 5),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_items (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monitoring_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    power SMALLINT NOT NULL CHECK (power BETWEEN 0 AND 100),
    water SMALLINT NOT NULL CHECK (water BETWEEN 0 AND 100),
    food SMALLINT NOT NULL CHECK (food BETWEEN 0 AND 100),
    temperature NUMERIC(4, 1) NOT NULL,
    humidity SMALLINT NOT NULL CHECK (humidity BETWEEN 0 AND 100),
    radiation SMALLINT NOT NULL CHECK (radiation >= 0)
);

CREATE INDEX monitoring_readings_recorded_at_idx
    ON monitoring_readings (recorded_at DESC);

COMMENT ON TABLE vault IS 'Profile and current state of the shelter';
COMMENT ON TABLE inventory_items IS 'Current amount of each stored resource';
COMMENT ON TABLE monitoring_readings IS 'Time series of demo sensor readings';



-- Demo data
INSERT INTO vault (id, name, status, occupants, security_level)
VALUES (1, 'Vaultspace Alpha', 'operational', 4, 3);

INSERT INTO inventory_items (code, label, quantity) VALUES
    ('water', 'Water', 340),
    ('food', 'Food', 128),
    ('medicine', 'Medicine', 24),
    ('fuel', 'Fuel', 76);

INSERT INTO monitoring_readings
    (recorded_at, power, water, food, temperature, humidity, radiation)
VALUES
    (now() - interval '15 minutes', 86, 73, 62, 22.1, 49, 16),
    (now() - interval '10 minutes', 87, 72, 62, 22.2, 48, 17),
    (now() - interval '5 minutes', 87, 72, 61, 22.3, 48, 17),
    (now(), 87, 72, 61, 22.4, 48, 17);
