<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class TransactionRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function create(int $userId, string $txnRef, int $amount, string $description = ''): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO transactions (user_id, txn_ref, amount, description, status) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $txnRef, $amount, $description, 'pending']);
        return (int) $this->db->lastInsertId();
    }

    public function findByTxnRef(string $txnRef): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE txn_ref = ?');
        $stmt->execute([$txnRef]);
        return $stmt->fetch() ?: null;
    }

    public function findByTxnRefForUpdate(string $txnRef): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE txn_ref = ? FOR UPDATE');
        $stmt->execute([$txnRef]);
        return $stmt->fetch() ?: null;
    }

    public function updateStatus(string $txnRef, string $status, ?string $responseCode = null, ?string $transactionNo = null, ?string $bankCode = null): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE transactions SET status = ?, vnp_response_code = ?, vnp_transaction_no = ?, bank_code = ? WHERE txn_ref = ?'
        );
        return $stmt->execute([$status, $responseCode, $transactionNo, $bankCode, $txnRef]);
    }

    public function getByUserId(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function createCompleted(int $userId, string $txnRef, int $amount, string $description = ''): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO transactions (user_id, txn_ref, amount, description, status) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $txnRef, $amount, $description, 'success']);
        return (int) $this->db->lastInsertId();
    }

    public function addBalance(int $userId, int $amount): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
        return $stmt->execute([$amount, $userId]);
    }

    public function getBalance(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT balance FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function getBalanceForUpdate(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }
}
