ALTER TABLE conversation_participants
ADD COLUMN last_read_at TIMESTAMP NULL DEFAULT NULL AFTER last_read_msg_id;
