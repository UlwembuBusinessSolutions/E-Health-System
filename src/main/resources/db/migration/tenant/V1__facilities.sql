CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CLINIC','HOSPITAL','STORE')),
    address VARCHAR(300),
    phone VARCHAR(20),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Johannesburg',
    active BOOLEAN NOT NULL DEFAULT true
);
