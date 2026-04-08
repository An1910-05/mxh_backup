<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class TiuXaiRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ---- Transactions ----

    public function beginTransaction(): void { $this->db->beginTransaction(); }
    public function commit(): void { $this->db->commit(); }
    public function rollBack(): void { $this->db->rollBack(); }

    // ---- Session ----

    public function getLatestSession(): ?array
    {
        $stmt = $this->db->query('SELECT * FROM tiu_xai_sessions ORDER BY id DESC LIMIT 1');
        return $stmt->fetch() ?: null;
    }

    public function getSessionById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM tiu_xai_sessions WHERE id=?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function lockSessionForUpdate(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM tiu_xai_sessions WHERE id=? FOR UPDATE');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function createSession(): int
    {
        $this->db->exec('INSERT INTO tiu_xai_sessions () VALUES ()');
        return (int) $this->db->lastInsertId();
    }

    public function setDice(int $sessionId, int $d1, int $d2, int $d3, int $jackpotPool): void
    {
        $total = $d1 + $d2 + $d3;
        $result = $total >= 11 ? 'xai' : 'tiu';
        $isJackpot = ($total === 3 || $total === 18) ? 1 : 0;
        $stmt = $this->db->prepare(
            'UPDATE tiu_xai_sessions SET dice1=?, dice2=?, dice3=?, total_points=?, result=?, is_jackpot=?, jackpot_snapshot=? WHERE id=?'
        );
        $stmt->execute([$d1, $d2, $d3, $total, $result, $isJackpot, $jackpotPool, $sessionId]);
    }

    public function markRewardProcessed(int $sessionId): void
    {
        $this->db->prepare('UPDATE tiu_xai_sessions SET reward_processed=1, rewarded_at=NOW() WHERE id=?')
            ->execute([$sessionId]);
    }

    public function getSessionHistory(int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM tiu_xai_sessions WHERE reward_processed=1 ORDER BY id DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll();
    }

    public function countCompletedSessions(): int
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM tiu_xai_sessions WHERE reward_processed=1')->fetchColumn();
    }

    public function getAllSessions(int $limit, int $offset): array
    {
        $stmt = $this->db->prepare('SELECT * FROM tiu_xai_sessions ORDER BY id DESC LIMIT ? OFFSET ?');
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll();
    }

    public function countAllSessions(): int
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM tiu_xai_sessions')->fetchColumn();
    }

    // ---- Bets ----

    public function getUserBet(int $sessionId, int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM tiu_xai_bets WHERE session_id=? AND user_id=?');
        $stmt->execute([$sessionId, $userId]);
        return $stmt->fetch() ?: null;
    }

    public function createBet(int $sessionId, int $userId, string $side, int $amount): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO tiu_xai_bets (session_id, user_id, side, amount) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$sessionId, $userId, $side, $amount]);
        return (int) $this->db->lastInsertId();
    }

    public function addToBet(int $betId, int $addAmount): void
    {
        $this->db->prepare('UPDATE tiu_xai_bets SET amount = amount + ? WHERE id=?')
            ->execute([$addAmount, $betId]);
    }

    public function updateSessionTotals(int $sessionId, string $side, int $amount, int $playerDelta): void
    {
        if ($side === 'tiu') {
            $this->db->prepare(
                'UPDATE tiu_xai_sessions SET total_bet_tiu = total_bet_tiu + ?, player_count_tiu = player_count_tiu + ? WHERE id=?'
            )->execute([$amount, $playerDelta, $sessionId]);
        } else {
            $this->db->prepare(
                'UPDATE tiu_xai_sessions SET total_bet_xai = total_bet_xai + ?, player_count_xai = player_count_xai + ? WHERE id=?'
            )->execute([$amount, $playerDelta, $sessionId]);
        }
    }

    public function getSessionBets(int $sessionId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM tiu_xai_bets WHERE session_id=?');
        $stmt->execute([$sessionId]);
        return $stmt->fetchAll();
    }

    public function updateBet(int $betId, string $status, int $winAmount): void
    {
        $this->db->prepare('UPDATE tiu_xai_bets SET status=?, win_amount=? WHERE id=?')
            ->execute([$status, $winAmount, $betId]);
    }

    public function getPlayerBetHistory(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT b.*, s.dice1, s.dice2, s.dice3, s.total_points, s.result, s.is_jackpot
             FROM tiu_xai_bets b
             JOIN tiu_xai_sessions s ON b.session_id = s.id
             WHERE b.user_id=?
             ORDER BY b.id DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function getAllBets(int $limit, int $offset): array
    {
        $stmt = $this->db->prepare(
            'SELECT b.*, u.username, s.result, s.total_points
             FROM tiu_xai_bets b
             JOIN users u ON b.user_id = u.id
             JOIN tiu_xai_sessions s ON b.session_id = s.id
             ORDER BY b.id DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll();
    }

    public function countAllBets(): int
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM tiu_xai_bets')->fetchColumn();
    }

    // ---- Balance ----

    public function getBalance(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT balance FROM users WHERE id=? FOR UPDATE');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function deductBalance(int $userId, int $amount): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET balance = balance - ? WHERE id=? AND balance >= ?'
        );
        $stmt->execute([$amount, $userId, $amount]);
        return $stmt->rowCount() > 0;
    }

    public function addBalance(int $userId, int $amount): void
    {
        $this->db->prepare('UPDATE users SET balance = balance + ? WHERE id=?')
            ->execute([$amount, $userId]);
    }

    public function getBalanceNoLock(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT balance FROM users WHERE id=?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    // ---- Jackpot ----

    public function getJackpotPool(): int
    {
        $stmt = $this->db->query('SELECT pool FROM tiu_xai_jackpot WHERE id=1');
        $row = $stmt->fetch();
        return $row ? (int) $row['pool'] : 50000000;
    }

    public function addToJackpot(int $amount): void
    {
        $this->db->prepare('UPDATE tiu_xai_jackpot SET pool = pool + ? WHERE id=1')
            ->execute([$amount]);
    }

    public function payoutJackpot(int $paidAmount, int $minPool): void
    {
        $this->db->prepare(
            'UPDATE tiu_xai_jackpot SET pool = ?, total_paid = total_paid + ? WHERE id=1'
        )->execute([$minPool, $paidAmount]);
    }

    // ---- Config ----

    public function getConfig(): array
    {
        $stmt = $this->db->query('SELECT config_key, config_value FROM tiu_xai_config');
        $config = [];
        foreach ($stmt->fetchAll() as $row) {
            $config[$row['config_key']] = $row['config_value'];
        }
        return $config;
    }

    public function setConfig(string $key, string $value): void
    {
        $this->db->prepare(
            'INSERT INTO tiu_xai_config (config_key, config_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE config_value=?'
        )->execute([$key, $value, $value]);
    }
}
