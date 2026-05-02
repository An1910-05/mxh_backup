<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopProductRepository
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

        if (!empty($filters['category_id'])) {
            $where[] = 'p.category_id = ?';
            $params[] = $filters['category_id'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'p.seller_id = ?';
            $params[] = $filters['seller_id'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'p.status = ?';
            $params[] = $filters['status'];
        }

        if (!empty($filters['product_type'])) {
            $where[] = 'p.product_type = ?';
            $params[] = $filters['product_type'];
        }

        if (!empty($filters['search'])) {
            $where[] = 'MATCH(p.title, p.description) AGAINST(? IN NATURAL LANGUAGE MODE)';
            $params[] = $filters['search'];
        }

        $whereClause = implode(' AND ', $where);
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $this->db->prepare("
            SELECT
                p.*,
                u.username as seller_username,
                u.avatar as seller_avatar,
                c.name as category_name,
                c.slug as category_slug
            FROM shop_products p
            JOIN users u ON p.seller_id = u.id
            JOIN shop_categories c ON p.category_id = c.id
            WHERE {$whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                p.*,
                u.username as seller_username,
                u.avatar as seller_avatar,
                c.name as category_name,
                c.slug as category_slug
            FROM shop_products p
            JOIN users u ON p.seller_id = u.id
            JOIN shop_categories c ON p.category_id = c.id
            WHERE p.id = ?
        ");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_products (
                seller_id, category_id, title, description, product_type,
                price, stock_quantity, images, digital_file_url, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['seller_id'],
            $data['category_id'],
            $data['title'],
            $data['description'],
            $data['product_type'],
            $data['price'],
            $data['stock_quantity'] ?? null,
            json_encode($data['images'] ?? []),
            $data['digital_file_url'] ?? null,
            $data['status'] ?? 'draft'
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        if (isset($data['category_id'])) {
            $fields[] = 'category_id = ?';
            $values[] = $data['category_id'];
        }
        if (isset($data['title'])) {
            $fields[] = 'title = ?';
            $values[] = $data['title'];
        }
        if (isset($data['description'])) {
            $fields[] = 'description = ?';
            $values[] = $data['description'];
        }
        if (isset($data['product_type'])) {
            $fields[] = 'product_type = ?';
            $values[] = $data['product_type'];
        }
        if (isset($data['price'])) {
            $fields[] = 'price = ?';
            $values[] = $data['price'];
        }
        if (isset($data['stock_quantity'])) {
            $fields[] = 'stock_quantity = ?';
            $values[] = $data['stock_quantity'];
        }
        if (isset($data['images'])) {
            $fields[] = 'images = ?';
            $values[] = json_encode($data['images']);
        }
        if (isset($data['digital_file_url'])) {
            $fields[] = 'digital_file_url = ?';
            $values[] = $data['digital_file_url'];
        }
        if (isset($data['status'])) {
            $fields[] = 'status = ?';
            $values[] = $data['status'];
        }
        if (isset($data['rejection_reason'])) {
            $fields[] = 'rejection_reason = ?';
            $values[] = $data['rejection_reason'];
        }
        if (isset($data['approved_at'])) {
            $fields[] = 'approved_at = ?';
            $values[] = $data['approved_at'];
        }
        if (isset($data['approved_by'])) {
            $fields[] = 'approved_by = ?';
            $values[] = $data['approved_by'];
        }

        if (empty($fields)) {
            return false;
        }

        $values[] = $id;
        $sql = "UPDATE shop_products SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM shop_products WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function incrementViewCount(int $id): bool
    {
        $stmt = $this->db->prepare("UPDATE shop_products SET view_count = view_count + 1 WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function incrementSoldCount(int $id, int $quantity = 1): bool
    {
        $stmt = $this->db->prepare("UPDATE shop_products SET sold_count = sold_count + ? WHERE id = ?");
        return $stmt->execute([$quantity, $id]);
    }

    public function decrementStock(int $id, int $quantity = 1): bool
    {
        $stmt = $this->db->prepare("
            UPDATE shop_products
            SET stock_quantity = stock_quantity - ?,
                status = CASE WHEN stock_quantity - ? <= 0 THEN 'sold_out' ELSE status END
            WHERE id = ? AND stock_quantity IS NOT NULL AND stock_quantity >= ?
        ");
        return $stmt->execute([$quantity, $quantity, $id, $quantity]);
    }

    public function incrementStock(int $id, int $quantity = 1): bool
    {
        $stmt = $this->db->prepare("
            UPDATE shop_products
            SET stock_quantity = stock_quantity + ?,
                status = CASE WHEN status = 'sold_out' THEN 'approved' ELSE status END
            WHERE id = ? AND stock_quantity IS NOT NULL
        ");
        return $stmt->execute([$quantity, $id]);
    }

    public function countByFilters(array $filters = []): int
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['category_id'])) {
            $where[] = 'category_id = ?';
            $params[] = $filters['category_id'];
        }

        if (!empty($filters['seller_id'])) {
            $where[] = 'seller_id = ?';
            $params[] = $filters['seller_id'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }

        if (!empty($filters['product_type'])) {
            $where[] = 'product_type = ?';
            $params[] = $filters['product_type'];
        }

        if (!empty($filters['search'])) {
            $where[] = 'MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE)';
            $params[] = $filters['search'];
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM shop_products WHERE {$whereClause}");
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }
}
