<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ShopReviewRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                r.*,
                u.username AS buyer_username,
                up.avatar  AS buyer_avatar
            FROM shop_reviews r
            JOIN users u ON r.buyer_id = u.id
            LEFT JOIN profiles up ON r.buyer_id = up.user_id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByOrderId(int $orderId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                r.*,
                u.username AS buyer_username,
                up.avatar  AS buyer_avatar
            FROM shop_reviews r
            JOIN users u ON r.buyer_id = u.id
            LEFT JOIN profiles up ON r.buyer_id = up.user_id
            WHERE r.order_id = ?
        ");
        $stmt->execute([$orderId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByProduct(int $productId, ?int $ratingFilter = null, int $limit = 20, int $offset = 0): array
    {
        $params = [$productId];
        $extra = '';
        if ($ratingFilter !== null && $ratingFilter >= 1 && $ratingFilter <= 5) {
            $extra = ' AND r.rating = ?';
            $params[] = $ratingFilter;
        }
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $this->db->prepare("
            SELECT
                r.*,
                u.username AS buyer_username,
                up.avatar  AS buyer_avatar
            FROM shop_reviews r
            JOIN users u ON r.buyer_id = u.id
            LEFT JOIN profiles up ON r.buyer_id = up.user_id
            WHERE r.product_id = ? AND r.is_hidden = 0 {$extra}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findBySeller(int $sellerId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare("
            SELECT
                r.*,
                u.username AS buyer_username,
                up.avatar  AS buyer_avatar,
                p.title    AS product_title
            FROM shop_reviews r
            JOIN users u ON r.buyer_id = u.id
            LEFT JOIN profiles up ON r.buyer_id = up.user_id
            JOIN shop_products p ON r.product_id = p.id
            WHERE r.seller_id = ? AND r.is_hidden = 0
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$sellerId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function statsForProduct(int $productId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                COUNT(*)                                          AS total,
                COALESCE(AVG(rating), 0)                          AS avg_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)       AS s5,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)       AS s4,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)       AS s3,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)       AS s2,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)       AS s1,
                SUM(CASE WHEN images IS NOT NULL AND JSON_LENGTH(images) > 0 THEN 1 ELSE 0 END) AS with_images
            FROM shop_reviews
            WHERE product_id = ? AND is_hidden = 0
        ");
        $stmt->execute([$productId]);
        $row = $stmt->fetch() ?: [];
        return [
            'total'       => (int)($row['total'] ?? 0),
            'avgRating'   => round((float)($row['avg_rating'] ?? 0), 2),
            'star5'       => (int)($row['s5'] ?? 0),
            'star4'       => (int)($row['s4'] ?? 0),
            'star3'       => (int)($row['s3'] ?? 0),
            'star2'       => (int)($row['s2'] ?? 0),
            'star1'       => (int)($row['s1'] ?? 0),
            'withImages'  => (int)($row['with_images'] ?? 0),
        ];
    }

    public function statsForSeller(int $sellerId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                COUNT(*)                          AS total,
                COALESCE(AVG(rating), 0)          AS avg_rating
            FROM shop_reviews
            WHERE seller_id = ? AND is_hidden = 0
        ");
        $stmt->execute([$sellerId]);
        $row = $stmt->fetch() ?: [];
        return [
            'total'     => (int)($row['total'] ?? 0),
            'avgRating' => round((float)($row['avg_rating'] ?? 0), 2),
        ];
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO shop_reviews
                (order_id, product_id, buyer_id, seller_id, rating, content, images)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['order_id'],
            $data['product_id'],
            $data['buyer_id'],
            $data['seller_id'],
            $data['rating'],
            $data['content'],
            isset($data['images']) ? json_encode($data['images']) : null,
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];
        if (isset($data['rating']))  { $fields[] = 'rating = ?';  $values[] = $data['rating']; }
        if (isset($data['content'])) { $fields[] = 'content = ?'; $values[] = $data['content']; }
        if (array_key_exists('images', $data)) {
            $fields[] = 'images = ?';
            $values[] = $data['images'] === null ? null : json_encode($data['images']);
        }
        if (empty($fields)) return false;
        $values[] = $id;
        $sql = 'UPDATE shop_reviews SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }

    public function reply(int $id, string $reply): bool
    {
        $stmt = $this->db->prepare("
            UPDATE shop_reviews
            SET seller_reply = ?, replied_at = NOW()
            WHERE id = ?
        ");
        return $stmt->execute([$reply, $id]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM shop_reviews WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
