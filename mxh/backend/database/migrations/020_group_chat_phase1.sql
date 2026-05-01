USE mxh_social;

-- Group chat Phase 1 + 2: thêm dissolved_at để owner có thể giải tán nhóm
-- Schema 006 đã có sẵn type ENUM('private','group'), title, avatar, created_by,
-- conversation_participants.role ENUM('owner','admin','member') → đủ cho group chat.
-- Migration này chỉ bổ sung cột dissolved_at và index hỗ trợ truy vấn group.

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS dissolved_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at;

-- Index để query nhanh nhóm chưa giải tán theo loại (đặc biệt khi list conversations)
CREATE INDEX IF NOT EXISTS idx_type_dissolved ON conversations (type, dissolved_at);

-- Index hỗ trợ kiểm role theo conversation
CREATE INDEX IF NOT EXISTS idx_conv_role ON conversation_participants (conversation_id, role);

INSERT INTO _migrations (filename, executed_at)
VALUES ('020_group_chat_phase1.sql', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();
