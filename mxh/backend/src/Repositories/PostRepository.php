<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class PostRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, u.username, u.is_verified AS user_is_verified, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findAll(int $limit = 20, int $offset = 0, ?int $viewerId = null, array $friendIds = []): array
    {
        [$visSql, $visParams] = $this->visibilityClause($viewerId, $friendIds);
        $stmt = $this->db->prepare(
            "SELECT p.*, u.username, u.is_verified AS user_is_verified, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE {$visSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute([...$visParams, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function findByUserId(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, u.username, u.is_verified AS user_is_verified, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function findByUserIds(array $userIds, int $limit = 20, int $offset = 0, ?int $viewerId = null, array $friendIds = []): array
    {
        if (empty($userIds)) return [];
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        [$visSql, $visParams] = $this->visibilityClause($viewerId, $friendIds);
        $sql = "SELECT p.*, u.username, u.is_verified AS user_is_verified, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.user_id IN ({$placeholders}) AND {$visSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([...$userIds, ...$visParams, $limit, $offset]);
        return $stmt->fetchAll();
    }

    /**
     * Dựng điều kiện WHERE lọc bài theo chế độ private của tác giả.
     * Cho xem khi: tác giả public, HOẶC là bài của chính viewer, HOẶC tác giả là bạn của viewer.
     * @return array{0: string, 1: array} [sqlFragment, params]
     */
    private function visibilityClause(?int $viewerId, array $friendIds): array
    {
        if ($viewerId === null) {
            return ['u.is_private = 0', []];
        }

        $ors = ['u.is_private = 0', 'p.user_id = ?'];
        $params = [$viewerId];

        $friendIds = array_values(array_unique(array_map('intval', $friendIds)));
        if (!empty($friendIds)) {
            $ph = implode(',', array_fill(0, count($friendIds), '?'));
            $ors[] = "p.user_id IN ({$ph})";
            $params = array_merge($params, $friendIds);
        }

        return ['(' . implode(' OR ', $ors) . ')', $params];
    }

    public function create(int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?string $locationLabel = null, ?float $latitude = null, ?float $longitude = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO posts (user_id, content, media_url, media_type, media_width, media_height, location_label, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $locationLabel, $latitude, $longitude]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, string $content): bool
    {
        $stmt = $this->db->prepare('UPDATE posts SET content = ? WHERE id = ?');
        return $stmt->execute([$content, $id]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM posts WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function countByUserId(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM posts WHERE user_id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }
}
