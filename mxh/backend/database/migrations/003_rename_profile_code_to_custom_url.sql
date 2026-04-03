USE mxh_social;

ALTER TABLE users DROP INDEX idx_profile_code;
ALTER TABLE users CHANGE COLUMN profile_code custom_url VARCHAR(30) UNIQUE NULL;
CREATE INDEX idx_custom_url ON users(custom_url);
