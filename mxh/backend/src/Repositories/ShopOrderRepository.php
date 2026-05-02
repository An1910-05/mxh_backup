<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopOrderRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAll(array $filters = [], int $limit = 20, int $offset = 0): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['buyer_id'])) {
            $where[] = 'o.buyer_id = ?';
            $params[] = $filters['buyer_id'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'o.seller_id = ?';
            $params[] = $filters['seller_id'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'o.status = ?';
            $params[] = $filters['status'];
        }

        $whereClause = implode(' AND ', $where);
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $this->db->prepare("
            SELECT
                o.*,
                buyer.username as buyer_username,
                buyer.avatar as buyer_avatar,
                seller.username as seller_username,
                seller.avatar as seller_avatar,
                p.title as product_title,
                p.images as product_images
            FROM shop_orders o
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            JOIN shop_products p ON o.product_id = p.id
            WHERE {$whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                o.*,
                buyer.username as buyer_username,
                buyer.avatar as buyer_avatar,
                seller.username as seller_username,
                seller.avatar as seller_avatar,
                p.title as product_title,
                p.images as product_images
            FROM shop_orders o
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            JOIN shop_products p ON o.product_id = p.id
            WHERE o.id = ?
        ");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function findByOrderNumber(string $orderNumber): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                o.*,
                buyer.username as buyer_username,
                buyer.avatar as buyer_avatar,
                seller.username as seller_username,
                seller.avatar as seller_avatar,
                p.title as product_title,
                p.images as product_images
            FROM shop_orders o
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            JOIN shop_products p ON o.product_id = p.id
            WHERE o.order_number = ?
        ");
        $stmt->execute([$orderNumber]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_orders (
                order_number, buyer_id, seller_id, product_id, product_snapshot,
                quantity, unit_price, total_price, commission_rate, commission_amount,
                seller_amount, status, payment_status, shipping_address, buyer_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['order_number'],
            $data['buyer_id'],
            $data['seller_id'],
            $data['product_id'],
            json_encode($data['product_snapshot']),
            $data['quantity'],
            $data['unit_price'],
            $data['total_price'],
            $data['commission_rate'],
            $data['commission_amount'],
            $data['seller_amount'],
            $data['status'] ?? 'pending',
            $data['payment_status'] ?? 'pending',
            isset($data['shipping_address']) ? json_encode($data['shipping_address']) : null,
            $data['buyer_notes'] ?? null
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        if (isset($data['status'])) {
            $fields[] = 'status = ?';
            $values[] = $data['status'];
        }
        if (isset($data['payment_status'])) {
            $fields[] = 'payment_status = ?';
            $values[] = $data['payment_status'];
        }
        if (isset($data['escrow_transaction_id'])) {
            $fields[] = 'escrow_transaction_id = ?';
            $values[] = $data['escrow_transaction_id'];
        }
        if (isset($data['tracking_number'])) {
            $fields[] = 'tracking_number = ?';
            $values[] = $data['tracking_number'];
        }
        if (isset($data['seller_notes'])) {
            $fields[] = 'seller_notes = ?';
            $values[] = $data['seller_notes'];
        }
        if (isset($data['cancellation_reason'])) {
            $fields[] = 'cancellation_reason = ?';
            $values[] = $data['cancellation_reason'];
        }
        if (isset($data['cancelled_by'])) {
            $fields[] = 'cancelled_by = ?';
            $values[] = $data['cancelled_by'];
        }
        if (isset($data['confirmed_at'])) {
            $fields[] = 'confirmed_at = ?';
            $values[] = $data['confirmed_at'];
        }
        if (isset($data['shipped_at'])) {
            $fields[] = 'shipped_at = ?';
            $values[] = $data['shipped_at'];
        }
        if (isset($data['delivered_at'])) {
            $fields[] = 'delivered_at = ?';
            $values[] = $data['delivered_at'];
        }
        if (isset($data['completed_at'])) {
            $fields[] = 'completed_at = ?';
            $values[] = $data['completed_at'];
        }
        if (isset($data['cancelled_at'])) {
            $fields[] = 'cancelled_at = ?';
            $values[] = $data['cancelled_at'];
        }

        if (empty($fields)) {
            return false;
        }

        $values[] = $id;
        $sql = "UPDATE shop_orders SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }

    public function generateOrderNumber(): string
    {
        $date = date('Ymd');
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM shop_orders
            WHERE order_number LIKE ?
        ");
        $stmt->execute(["SHOP-{$date}-%"]);
        $count = (int) $stmt->fetchColumn();
        $sequence = str_pad($count + 1, 5, '0', STR_PAD_LEFT);
        return "SHOP-{$date}-{$sequence}";
    }

    public function countByFilters(array $filters = []): int
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['buyer_id'])) {
            $where[] = 'buyer_id = ?';
            $params[] = $filters['buyer_id'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'seller_id = ?';
            $params[] = $filters['seller_id'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM shop_orders WHERE {$whereClause}");
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }
}
