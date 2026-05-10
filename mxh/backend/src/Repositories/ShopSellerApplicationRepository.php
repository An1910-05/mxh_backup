<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopSellerApplicationRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $sql = "SELECT a.*, u.username AS applicant_username, u.email AS applicant_email,
                       r.username AS reviewer_username
                FROM shop_seller_applications a
                JOIN users u ON u.id = a.user_id
                LEFT JOIN users r ON r.id = a.reviewed_by
                WHERE a.id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByUserId(int $userId): ?array
    {
        $sql = "SELECT a.*, u.username AS applicant_username, u.email AS applicant_email,
                       r.username AS reviewer_username
                FROM shop_seller_applications a
                JOIN users u ON u.id = a.user_id
                LEFT JOIN users r ON r.id = a.reviewed_by
                WHERE a.user_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function listByStatus(string $status, int $limit = 50, int $offset = 0): array
    {
        $sql = "SELECT a.*, u.username AS applicant_username, u.email AS applicant_email,
                       r.username AS reviewer_username
                FROM shop_seller_applications a
                JOIN users u ON u.id = a.user_id
                LEFT JOIN users r ON r.id = a.reviewed_by
                WHERE a.status = ?
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $status, PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function insert(int $userId, string $storeName, string $intro, string $phone, string $address): int
    {
        $sql = "INSERT INTO shop_seller_applications (user_id, store_name, intro, phone, address, status)
                VALUES (?, ?, ?, ?, ?, 'pending')";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $storeName, $intro, $phone, $address]);
        return (int)$this->db->lastInsertId();
    }

    public function resubmit(int $id, string $storeName, string $intro, string $phone, string $address): bool
    {
        $sql = "UPDATE shop_seller_applications
                SET store_name = ?, intro = ?, phone = ?, address = ?,
                    status = 'pending', rejection_reason = NULL,
                    reviewed_by = NULL, reviewed_at = NULL
                WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$storeName, $intro, $phone, $address, $id]);
    }

    public function approve(int $id, int $reviewerId): bool
    {
        $sql = "UPDATE shop_seller_applications
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(),
                    rejection_reason = NULL
                WHERE id = ? AND status = 'pending'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$reviewerId, $id]);
        return $stmt->rowCount() > 0;
    }

    public function reject(int $id, int $reviewerId, string $reason): bool
    {
        $sql = "UPDATE shop_seller_applications
                SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(),
                    rejection_reason = ?
                WHERE id = ? AND status = 'pending'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$reviewerId, $reason, $id]);
        return $stmt->rowCount() > 0;
    }

    public function setUserIsSeller(int $userId, bool $isSeller): bool
    {
        $sql = "UPDATE users SET is_seller = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$isSeller ? 1 : 0, $userId]);
    }

    public function userIsSeller(int $userId): bool
    {
        $sql = "SELECT is_seller FROM users WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId]);
        return (bool)$stmt->fetchColumn();
    }
}
