<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class CaroRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT * FROM caro_rooms WHERE id = ?';
        if ($forUpdate) $sql .= ' FOR UPDATE';
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByCode(string $code): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM caro_rooms WHERE code = ?');
        $stmt->execute([$code]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function codeExists(string $code): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM caro_rooms WHERE code = ?');
        $stmt->execute([$code]);
        return (bool) $stmt->fetchColumn();
    }

    public function createRoom(array $data): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO caro_rooms
                (code, name, password_hash, visibility, is_matchmaking,
                 status, creator_id, board_size, win_length, board_state, current_turn)
             VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, 'X')"
        );
        $stmt->execute([
            $data['code'],
            $data['name'] ?? null,
            $data['password_hash'] ?? null,
            $data['visibility'] ?? 'private',
            $data['is_matchmaking'] ?? 0,
            $data['creator_id'],
            $data['board_size'] ?? 15,
            $data['win_length'] ?? 5,
            $data['board_state'] ?? json_encode([]),
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function joinRoom(int $roomId, int $opponentId): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE caro_rooms
                SET opponent_id = ?, status = 'playing', is_matchmaking = 0, last_move_at = NOW()
              WHERE id = ? AND status = 'waiting' AND opponent_id IS NULL"
        );
        $stmt->execute([$opponentId, $roomId]);
        return $stmt->rowCount() > 0;
    }

    public function applyMove(int $roomId, string $boardStateJson, int $moveCount, string $nextTurn): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE caro_rooms
                SET board_state = ?, move_count = ?, current_turn = ?, last_move_at = NOW()
              WHERE id = ? AND status = 'playing'"
        );
        $stmt->execute([$boardStateJson, $moveCount, $nextTurn, $roomId]);
        return $stmt->rowCount() > 0;
    }

    public function finishRoom(int $roomId, ?string $winnerSymbol, ?int $winnerUserId, string $finalBoardJson, int $moveCount): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE caro_rooms
                SET status = 'finished',
                    winner_symbol = ?, winner_user_id = ?,
                    board_state = ?, move_count = ?, last_move_at = NOW()
              WHERE id = ?"
        );
        $stmt->execute([$winnerSymbol, $winnerUserId, $finalBoardJson, $moveCount, $roomId]);
        return $stmt->rowCount() > 0;
    }

    public function abandonRoom(int $roomId, ?int $winnerUserId, ?string $winnerSymbol): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE caro_rooms
                SET status = 'abandoned',
                    winner_symbol = ?, winner_user_id = ?, last_move_at = NOW()
              WHERE id = ? AND status IN ('waiting','playing')"
        );
        $stmt->execute([$winnerSymbol, $winnerUserId, $roomId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Tìm 1 phòng matchmaking đang chờ, không phải của user hiện tại.
     * Dùng FOR UPDATE để claim phòng trong transaction.
     */
    public function findOpenMatchmakingRoom(int $excludeUserId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM caro_rooms
              WHERE is_matchmaking = 1
                AND status = 'waiting'
                AND opponent_id IS NULL
                AND creator_id <> ?
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE"
        );
        $stmt->execute([$excludeUserId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Danh sách phòng public đang chờ + của user (đang chơi/chờ).
     */
    public function listOpenPublicRooms(int $limit = 30): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM caro_rooms
              WHERE visibility = 'public'
                AND status = 'waiting'
                AND opponent_id IS NULL
              ORDER BY created_at DESC
              LIMIT ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function listMyActiveRooms(int $userId, int $limit = 10): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM caro_rooms
              WHERE (creator_id = ? OR opponent_id = ?)
                AND status IN ('waiting', 'playing')
              ORDER BY updated_at DESC
              LIMIT ?"
        );
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);
        $stmt->bindValue(2, $userId, PDO::PARAM_INT);
        $stmt->bindValue(3, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function listMyRecentFinished(int $userId, int $limit = 10): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM caro_rooms
              WHERE (creator_id = ? OR opponent_id = ?)
                AND status IN ('finished', 'abandoned')
              ORDER BY updated_at DESC
              LIMIT ?"
        );
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);
        $stmt->bindValue(2, $userId, PDO::PARAM_INT);
        $stmt->bindValue(3, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function deleteWaitingRoom(int $roomId, int $creatorId): bool
    {
        $stmt = $this->db->prepare(
            "DELETE FROM caro_rooms
              WHERE id = ? AND creator_id = ? AND status = 'waiting' AND opponent_id IS NULL"
        );
        $stmt->execute([$roomId, $creatorId]);
        return $stmt->rowCount() > 0;
    }

    /** Xoá tất cả phòng matchmaking đang waiting của user. */
    public function deleteUserWaitingMatchmakingRooms(int $userId): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM caro_rooms
              WHERE creator_id = ? AND is_matchmaking = 1
                AND status = 'waiting' AND opponent_id IS NULL"
        );
        $stmt->execute([$userId]);
    }

    /** Xoá các phòng waiting quá X phút (dùng PHP timestamp để tránh lỗi INTERVAL binding). */
    public function cleanupStaleWaitingRooms(int $olderThanMinutes = 15): void
    {
        $cutoff = date('Y-m-d H:i:s', time() - $olderThanMinutes * 60);
        $stmt = $this->db->prepare(
            "DELETE FROM caro_rooms
              WHERE status = 'waiting'
                AND opponent_id IS NULL
                AND created_at < ?"
        );
        $stmt->execute([$cutoff]);
    }
}
