-- Add provider + momo fields to transactions so we can support multiple payment gateways.
ALTER TABLE transactions
  ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'vnpay' AFTER status,
  ADD COLUMN momo_request_id VARCHAR(100) DEFAULT NULL AFTER bank_code,
  ADD COLUMN momo_trans_id VARCHAR(100) DEFAULT NULL AFTER momo_request_id;

CREATE INDEX idx_transactions_provider ON transactions (provider);

INSERT INTO _migrations (filename) VALUES ('024_add_payment_provider_and_momo_fields');
