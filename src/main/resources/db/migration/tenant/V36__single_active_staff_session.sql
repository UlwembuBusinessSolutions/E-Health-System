-- One registry slot per staff account; login locks the user row before replacing it.
-- Existing tokens have no registry entry and require a fresh sign-in after rollout.
ALTER TABLE users ADD COLUMN active_session_jti varchar(36);
ALTER TABLE users ADD COLUMN active_session_expires_at timestamptz;
CREATE UNIQUE INDEX users_active_session_jti_idx ON users(active_session_jti)
    WHERE active_session_jti IS NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_active_session_complete CHECK
    ((active_session_jti IS NULL) = (active_session_expires_at IS NULL));
