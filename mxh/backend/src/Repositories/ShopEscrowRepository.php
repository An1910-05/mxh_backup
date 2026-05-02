<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopEscrowRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM shop_escrow_transactions WHERE id = ?
        ");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function findByOrderId(int $orderId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM shop_escrow_transactions WHERE order_id = ?
        ");
        $stmt->execute([$orderId]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_escrow_transactions (
                order_id, buyer_id, seller_id, amount, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['order_id'],
            $data['buyer_id'],
            $data['seller_id'],
            $data['amount'],
            $data['status'] ?? 'held',
            $data['notes'] ?? null
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function updateStatus(int $id, string $status, ?string $notes = null): bool
    {
        $timestamp = date('Y-m-d H:i:s');
        $timestampField = match($status) {
            'released' => 'released_at',
            'refunded' => 'refunded_at',
            default => null
        };

        if ($timestampField) {
            $stmt = $this->db->prepare("
                UPDATE shop_escrow_transactions
                SET status = ?, {$timestampField} = ?, notes = ?
                WHERE id = ?
            ");
            return $stmt->execute([$status, $timestamp, $notes, $id]);
        } else {
            $stmt = $this->db->prepare("
                UPDATE shop_escrow_transactions
                SET status = ?, notes = ?
                WHERE id = ?
            ");
            return $stmt->execute([$status, $notes, $id]);
        }
    }
}
