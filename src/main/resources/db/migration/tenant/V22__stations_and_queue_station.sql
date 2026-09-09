CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (facility_id, code)
);

CREATE INDEX idx_stations_facility_active ON stations(facility_id, active);

ALTER TABLE queue_tokens
    ADD COLUMN station_id UUID NULL REFERENCES stations(id);

CREATE INDEX idx_queue_tokens_facility_station_status
    ON queue_tokens(facility_id, station_id, status);
