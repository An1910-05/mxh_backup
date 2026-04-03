<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class PresenceRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function setOnline(int $userId): void
    {
        $stmt = $this->db->prepare('
            INSERT INTO user_presence (user_id, is_online, last_seen)
            VALUES (?, 1, NOW())
            ON DUPLICATE KEY UPDATE is_online = 1, last_seen = NOW()
        ');
        $stmt->execute([$userId]);
    }

    public function setOffline(int $userId): void
    {
        $stmt = $this->db->prepare('
            INSERT INTO user_presence (user_id, is_online, last_seen)
            VALUES (?, 0, NOW())
            ON DUPLICATE KEY UPDATE is_online = 0, last_seen = NOW()
        ');
        $stmt->execute([$userId]);
    }

    public function getPresence(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM user_presence WHERE user_id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function getMultiplePresence(array $userIds): array
    {
        if (empty($userIds)) return [];
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = $this->db->prepare("SELECT * FROM user_presence WHERE user_id IN ({$placeholders})");
        $stmt->execute($userIds);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($rows as $row) {
            $result[(int)$row['user_id']] = $row;
        }
        return $result;
    }
}
