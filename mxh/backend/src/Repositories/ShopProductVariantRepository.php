<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopProductVariantRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findByProduct(int $productId): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM shop_product_variants
            WHERE product_id = ?
            ORDER BY display_order ASC, id ASC
        ");
        $stmt->execute([$productId]);
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM shop_product_variants WHERE id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Insert a list of variants for a product.
     * Each item: ['name' => string, 'price' => int, 'stock_quantity' => ?int, 'image' => ?string]
     */
    public function bulkInsert(int $productId, array $variants): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_product_variants
                (product_id, name, price, stock_quantity, image, display_order)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $order = 0;
        foreach ($variants as $v) {
            $stmt->execute([
                $productId,
                $v['name'],
                $v['price'],
                $v['stock_quantity'] ?? null,
                $v['image'] ?? null,
                $v['display_order'] ?? $order,
            ]);
            $order++;
        }
    }

    public function deleteByProduct(int $productId): bool
    {
        $stmt = $this->db->prepare("DELETE FROM shop_product_variants WHERE product_id = ?");
        return $stmt->execute([$productId]);
    }

    /** Replace the full variant set for a product (delete-all then insert). */
    public function replaceForProduct(int $productId, array $variants): void
    {
        $this->deleteByProduct($productId);
        if (!empty($variants)) {
            $this->bulkInsert($productId, $variants);
        }
    }

    public function decrementStock(int $id, int $quantity = 1): bool
    {
        $stmt = $this->db->prepare("
            UPDATE shop_product_variants
            SET stock_quantity = stock_quantity - ?
            WHERE id = ? AND stock_quantity IS NOT NULL AND stock_quantity >= ?
        ");
        $stmt->execute([$quantity, $id, $quantity]);
        return $stmt->rowCount() > 0;
    }

    public function incrementStock(int $id, int $quantity = 1): bool
    {
        $stmt = $this->db->prepare("
            UPDATE shop_product_variants
            SET stock_quantity = stock_quantity + ?
            WHERE id = ? AND stock_quantity IS NOT NULL
        ");
        return $stmt->execute([$quantity, $id]);
    }
}
