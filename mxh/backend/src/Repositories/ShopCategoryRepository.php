<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopCategoryRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAll(): array
    {
        $stmt = $this->db->prepare("
            SELECT
                id, name, slug, description, icon, display_order, is_active, created_at,
                (SELECT COUNT(*) FROM shop_products WHERE category_id = shop_categories.id AND status = 'approved') as product_count
            FROM shop_categories
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                id, name, slug, description, icon, display_order, is_active, created_at,
                (SELECT COUNT(*) FROM shop_products WHERE category_id = shop_categories.id AND status = 'approved') as product_count
            FROM shop_categories
            WHERE id = ?
        ");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function findBySlug(string $slug): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                id, name, slug, description, icon, display_order, is_active, created_at,
                (SELECT COUNT(*) FROM shop_products WHERE category_id = shop_categories.id AND status = 'approved') as product_count
            FROM shop_categories
            WHERE slug = ?
        ");
        $stmt->execute([$slug]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_categories (name, slug, description, icon, display_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['slug'],
            $data['description'] ?? null,
            $data['icon'] ?? null,
            $data['display_order'] ?? 0,
            $data['is_active'] ?? 1
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        if (isset($data['name'])) {
            $fields[] = 'name = ?';
            $values[] = $data['name'];
        }
        if (isset($data['slug'])) {
            $fields[] = 'slug = ?';
            $values[] = $data['slug'];
        }
        if (isset($data['description'])) {
            $fields[] = 'description = ?';
            $values[] = $data['description'];
        }
        if (isset($data['icon'])) {
            $fields[] = 'icon = ?';
            $values[] = $data['icon'];
        }
        if (isset($data['display_order'])) {
            $fields[] = 'display_order = ?';
            $values[] = $data['display_order'];
        }
        if (isset($data['is_active'])) {
            $fields[] = 'is_active = ?';
            $values[] = $data['is_active'];
        }

        if (empty($fields)) {
            return false;
        }

        $values[] = $id;
        $sql = "UPDATE shop_categories SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM shop_categories WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
