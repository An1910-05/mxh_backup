<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ProfileRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM profiles WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    public function create(int $userId, ?string $bio = null, ?string $avatar = null, ?string $coverPhoto = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO profiles (user_id, bio, avatar, cover_photo) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $bio, $avatar, $coverPhoto]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $userId, array $data): bool
    {
        $fields = [];
        $values = [];

        if (array_key_exists('bio', $data)) {
            $fields[] = 'bio = ?';
            $values[] = $data['bio'];
        }

        if (array_key_exists('avatar', $data)) {
            $fields[] = 'avatar = ?';
            $values[] = $data['avatar'];
        }

        if (array_key_exists('cover_photo', $data)) {
            $fields[] = 'cover_photo = ?';
            $values[] = $data['cover_photo'];
        }

        if (empty($fields)) {
            return false;
        }

        $values[] = $userId;
        $sql = 'UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE user_id = ?';
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }
}
