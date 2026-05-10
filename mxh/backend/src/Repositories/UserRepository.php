<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class UserRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT u.id, u.username, u.email, u.custom_url, u.birthday, u.gender, u.balance, u.role, u.is_blocked, u.is_seller, u.created_at, u.updated_at, p.avatar FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByIdFull(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function findByUsername(string $username): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    public function findByCustomUrl(string $url): ?array
    {
        $stmt = $this->db->prepare('SELECT u.id, u.username, u.email, u.custom_url, u.created_at, u.updated_at, p.avatar FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.custom_url = ?');
        $stmt->execute([$url]);
        return $stmt->fetch() ?: null;
    }

    public function findByGoogleId(string $googleId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE google_id = ?');
        $stmt->execute([$googleId]);
        return $stmt->fetch() ?: null;
    }

    public function search(string $query, int $limit = 20, int $offset = 0): array
    {
        $query = trim($query);
        $query = ltrim($query, '@');
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $like = '%' . $query . '%';
        if (ctype_digit($query)) {
            $stmt = $this->db->prepare(
                'SELECT u.id, u.username, u.email, u.custom_url, u.created_at, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = u.id) AS avatar
                 FROM users u
                 WHERE u.id = ? OR u.username LIKE ? OR u.custom_url LIKE ?
                 ORDER BY (u.id = ?) DESC, u.username ASC
                 LIMIT ? OFFSET ?'
            );
            $stmt->execute([(int)$query, $like, $like, (int)$query, $limit, $offset]);
        } else {
            $stmt = $this->db->prepare(
                'SELECT u.id, u.username, u.email, u.custom_url, u.created_at, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = u.id) AS avatar
                 FROM users u
                 WHERE u.username LIKE ? OR u.custom_url LIKE ?
                 ORDER BY u.username ASC
                 LIMIT ? OFFSET ?'
            );
            $stmt->execute([$like, $like, $limit, $offset]);
        }
        return $stmt->fetchAll();
    }

    public function create(string $username, string $email, string $passwordHash, ?string $birthday = null, ?string $gender = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO users (username, email, password_hash, birthday, gender) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$username, $email, $passwordHash, $birthday, $gender]);
        return (int) $this->db->lastInsertId();
    }

    public function createFromGoogle(string $username, string $email, string $googleId, ?string $birthday = null, ?string $gender = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO users (username, email, password_hash, google_id, birthday, gender) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$username, $email, '', $googleId, $birthday, $gender]);
        return (int) $this->db->lastInsertId();
    }

    public function linkGoogleId(int $userId, string $googleId): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET google_id = ? WHERE id = ?');
        return $stmt->execute([$googleId, $userId]);
    }

    public function setResetToken(int $userId, string $token, string $expires): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?');
        return $stmt->execute([$token, $expires, $userId]);
    }

    public function findByResetToken(string $token): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()');
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    }

    public function updatePassword(int $userId, string $passwordHash): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?');
        return $stmt->execute([$passwordHash, $userId]);
    }

    public function updateProfile(int $userId, array $data): bool
    {
        $fields = [];
        $values = [];

        foreach (['birthday', 'gender', 'username'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$key = ?";
                $values[] = $data[$key];
            }
        }

        if (empty($fields)) return false;

        $values[] = $userId;
        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($values);
    }

    public function updateCustomUrl(int $userId, string $url): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET custom_url = ? WHERE id = ?');
        return $stmt->execute([$url, $userId]);
    }

    public function isCustomUrlTaken(string $url, ?int $excludeUserId = null): bool
    {
        if ($excludeUserId) {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE custom_url = ? AND id != ?');
            $stmt->execute([$url, $excludeUserId]);
        } else {
            $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE custom_url = ?');
            $stmt->execute([$url]);
        }
        return (int) $stmt->fetchColumn() > 0;
    }
}
