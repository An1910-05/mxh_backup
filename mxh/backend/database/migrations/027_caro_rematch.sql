ALTER TABLE caro_rooms
    ADD COLUMN IF NOT EXISTS rematch_room_id INT NULL DEFAULT NULL,
    ADD CONSTRAINT fk_caro_rematch FOREIGN KEY (rematch_room_id) REFERENCES caro_rooms(id) ON DELETE SET NULL;

INSERT INTO _migrations (filename, executed_at) VALUES ('027_caro_rematch.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
