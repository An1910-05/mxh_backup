USE mxh_social;

-- Ẩn hội thoại chỉ phía user (không hiện trong danh sách)
ALTER TABLE conversation_participants
ADD COLUMN hidden_at TIMESTAMP NULL DEFAULT NULL AFTER joined_at;
