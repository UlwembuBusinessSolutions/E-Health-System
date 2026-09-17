CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, name)
);

CREATE TABLE service_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    department_id UUID REFERENCES departments(id),
    name VARCHAR(200) NOT NULL,
    counter_label VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, name)
);

ALTER TABLE visits ADD COLUMN station_id UUID REFERENCES service_stations(id);
ALTER TABLE queue_tokens ADD COLUMN station_id UUID REFERENCES service_stations(id);
CREATE INDEX idx_stations_facility ON service_stations(facility_id);
CREATE INDEX idx_queue_tokens_station_status ON queue_tokens(station_id, status);
