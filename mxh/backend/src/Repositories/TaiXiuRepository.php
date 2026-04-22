<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class TaiXiuRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // ── Round code helper ───────────────────────────────────────────────

    public function getNextRoundCode(bool $forUpdate = false): int
    {
        $sql = 'SELECT round_code FROM tai_xiu_rounds ORDER BY id DESC LIMIT 1';
        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }
        $lastCode = $this->db->query($sql)->fetchColumn();
        return $lastCode ? ((int) $lastCode + 1) : 2001096;
    }

    // ── Jackpot ─────────────────────────────────────────────────────────

    public function getJackpotState(bool $forUpdate = false): array
    {
        $sql = 'SELECT tai_pool, xiu_pool FROM tai_xiu_jackpot_state WHERE id = 1';
        if ($forUpdate) $sql .= ' FOR UPDATE';
        $row = $this->db->query($sql)->fetch();
        return $row ?: ['tai_pool' => 50000, 'xiu_pool' => 50000];
    }

    public function updateJackpotState(int $taiPool, int $xiuPool): bool
    {
        $stmt = $this->db->prepare('UPDATE tai_xiu_jackpot_state SET tai_pool = ?, xiu_pool = ? WHERE id = 1');
        return $stmt->execute([$taiPool, $xiuPool]);
    }

    // ── Server-round: get or create current betting round ───────────────

    /**
     * Lấy phiên hiện tại (betting/rolling/result) hoặc tạo phiên mới.
     *
     * Thứ tự ưu tiên:
     *   1) Phiên betting còn deadline  → trả về (phase betting)
     *   2) Phiên finished nhưng nằm trong reveal window ($revealWindow giây sau deadline)
     *      → trả về (phase rolling hoặc result, tính phía service)
     *   3) Ngược lại → tạo phiên betting mới
     *
     * Gọi trong transaction kèm FOR UPDATE để tránh race.
     */
    public function getOrCreateCurrentRound(int $betSeconds = 20, int $revealWindow = 11, bool $forUpdate = false): array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';

        // Phiên mới nhất
        $stmt = $this->db->prepare(
            "SELECT * FROM tai_xiu_rounds ORDER BY id DESC LIMIT 1" . $lock
        );
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row) {
            $deadlineTs = $row['betting_deadline'] ? strtotime($row['betting_deadline']) : 0;
            $now        = time();

            // Case 1: phiên betting còn hiệu lực
            if ($row['status'] === 'betting' && $deadlineTs > $now) {
                return $row;
            }
            // Case 2: phiên finished và vẫn còn trong reveal window
            if ($row['status'] === 'finished' && ($now - $deadlineTs) < $revealWindow) {
                return $row;
            }
        }

        // Case 3: tạo phiên mới
        $roundCode = $this->getNextRoundCode($forUpdate);
        $deadline  = date('Y-m-d H:i:s', time() + $betSeconds);
        // Sinh md5 NGAY khi mở phiên để hiển thị liền (không đợi dice).
        // Chuỗi nguồn có round_code + timestamp + random bytes → luôn unique 32 hex.
        $md5 = md5($roundCode . ':' . microtime(true) . ':' . bin2hex(random_bytes(16)));
        $stmt = $this->db->prepare(
            "INSERT INTO tai_xiu_rounds
                (status, betting_deadline, round_code, md5_hash,
                 dice_1, dice_2, dice_3, total, result_key,
                 jackpot_side, jackpot_payout, tai_pool_snapshot, xiu_pool_snapshot)
             VALUES ('betting', ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0)"
        );
        $stmt->execute([$deadline, $roundCode, $md5]);
        $newId = (int) $this->db->lastInsertId();
        return $this->getRoundById($newId);
    }

    public function getRoundById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM tai_xiu_rounds WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function getExpiredBettingRound(): ?array
    {
        $stmt = $this->db->query(
            "SELECT * FROM tai_xiu_rounds
             WHERE status = 'betting' AND betting_deadline <= NOW()
             ORDER BY id ASC LIMIT 1 FOR UPDATE"
        );
        return $stmt->fetch() ?: null;
    }

    // ── Round resolution ─────────────────────────────────────────────────

    public function resolveRound(int $roundId, array $dice, int $total, string $resultKey, ?string $jackpotSide, int $jackpotPayout, int $taiPool, int $xiuPool, string $md5Hash = ''): bool
    {
        // md5_hash KHÔNG được update ở đây — nó đã được sinh lúc tạo phiên (getOrCreateCurrentRound)
        // để hiển thị ngay từ đầu phase betting. Param $md5Hash giữ để tương thích ngược, không dùng.
        $stmt = $this->db->prepare(
            "UPDATE tai_xiu_rounds SET
                status = 'finished',
                dice_1 = ?, dice_2 = ?, dice_3 = ?,
                total = ?, result_key = ?,
                jackpot_side = ?, jackpot_payout = ?,
                tai_pool_snapshot = ?, xiu_pool_snapshot = ?
             WHERE id = ? AND status = 'betting'"
        );
        $stmt->execute([
            $dice[0], $dice[1], $dice[2],
            $total, $resultKey,
            $jackpotSide, $jackpotPayout,
            $taiPool, $xiuPool,
            $roundId,
        ]);
        return $stmt->rowCount() > 0;
    }

    // ── Bets (server-round style) ────────────────────────────────────────

    /** Create a pending bet (before dice are rolled) */
    public function createPendingBet(int $roundId, int $userId, string $side, int $amount): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO tai_xiu_bets
                (round_id, user_id, bet_side, bet_amount, is_pending,
                 result_key, did_win, net_amount, balance_after,
                 jackpot_hit, jackpot_payout)
             VALUES (?, ?, ?, ?, 1, NULL, NULL, NULL, NULL, 0, 0)'
        );
        $stmt->execute([$roundId, $userId, $side, $amount]);
        return (int) $this->db->lastInsertId();
    }

    /** Get all pending bets for a round */
    public function getPendingBetsByRound(int $roundId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM tai_xiu_bets WHERE round_id = ? AND is_pending = 1 FOR UPDATE'
        );
        $stmt->execute([$roundId]);
        return $stmt->fetchAll();
    }

    /** Resolve a single bet */
    public function resolveBet(int $betId, string $resultKey, bool $didWin, int $netAmount, int $balanceAfter, bool $jackpotHit, int $jackpotPayout): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE tai_xiu_bets SET
                is_pending = 0,
                result_key = ?, did_win = ?, net_amount = ?,
                balance_after = ?, jackpot_hit = ?, jackpot_payout = ?
             WHERE id = ?'
        );
        return $stmt->execute([
            $resultKey, $didWin ? 1 : 0, $netAmount,
            $balanceAfter, $jackpotHit ? 1 : 0, $jackpotPayout,
            $betId,
        ]);
    }

    /** Check if this user already placed a bet on a round */
    public function getUserBetForRound(int $roundId, int $userId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM tai_xiu_bets WHERE round_id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->execute([$roundId, $userId]);
        return $stmt->fetch() ?: null;
    }

    /** Aggregated bet totals for current round */
    public function getRoundBetStats(int $roundId): array
    {
        $stmt = $this->db->prepare(
            'SELECT bet_side, COUNT(*) AS bet_count, COALESCE(SUM(bet_amount),0) AS total_amount
             FROM tai_xiu_bets WHERE round_id = ? GROUP BY bet_side'
        );
        $stmt->execute([$roundId]);
        $rows = $stmt->fetchAll();
        $out = ['tai_total' => 0, 'tai_count' => 0, 'xiu_total' => 0, 'xiu_count' => 0];
        foreach ($rows as $r) {
            $side = $r['bet_side'];
            $out[$side . '_total'] = (int) $r['total_amount'];
            $out[$side . '_count'] = (int) $r['bet_count'];
        }
        return $out;
    }

    // ── Legacy / History ────────────────────────────────────────────────

    public function createRound(array $payload): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO tai_xiu_rounds
                (status, round_code, md5_hash,
                 dice_1, dice_2, dice_3, total, result_key,
                 jackpot_side, jackpot_payout, tai_pool_snapshot, xiu_pool_snapshot)
             VALUES ('finished', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $payload['round_code'], $payload['md5_hash'],
            $payload['dice_1'], $payload['dice_2'], $payload['dice_3'],
            $payload['total'], $payload['result_key'],
            $payload['jackpot_side'], $payload['jackpot_payout'],
            $payload['tai_pool_snapshot'], $payload['xiu_pool_snapshot'],
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function createBet(array $payload): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO tai_xiu_bets
                (round_id, user_id, bet_side, bet_amount, is_pending,
                 result_key, did_win, net_amount, balance_after,
                 jackpot_hit, jackpot_payout)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $payload['round_id'], $payload['user_id'],
            $payload['bet_side'], $payload['bet_amount'],
            $payload['result_key'], $payload['did_win'] ? 1 : 0,
            $payload['net_amount'], $payload['balance_after'],
            $payload['jackpot_hit'] ? 1 : 0, $payload['jackpot_payout'],
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function getBetHistoryByUser(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT b.id, b.round_id, b.bet_side, b.bet_amount, b.result_key,
                    b.did_win, b.net_amount, b.balance_after,
                    b.jackpot_hit, b.jackpot_payout, b.created_at,
                    r.round_code, r.md5_hash,
                    r.dice_1, r.dice_2, r.dice_3, r.total, r.jackpot_side
             FROM tai_xiu_bets b
             INNER JOIN tai_xiu_rounds r ON r.id = b.round_id
             WHERE b.user_id = ? AND b.is_pending = 0
             ORDER BY b.id DESC LIMIT ? OFFSET ?'
        );
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit,  PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getRecentRounds(int $limit = 20): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, round_code, md5_hash, dice_1, dice_2, dice_3,
                    total, result_key, jackpot_side, jackpot_payout,
                    tai_pool_snapshot, xiu_pool_snapshot, created_at
             FROM tai_xiu_rounds
             WHERE status = 'finished'
             ORDER BY id DESC LIMIT ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getJackpotHistory(int $limit = 20): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, round_code, md5_hash, dice_1, dice_2, dice_3,
                    total, result_key, jackpot_side, jackpot_payout,
                    tai_pool_snapshot, xiu_pool_snapshot, created_at
             FROM tai_xiu_rounds
             WHERE status = 'finished' AND jackpot_side IS NOT NULL AND jackpot_payout > 0
             ORDER BY id DESC LIMIT ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getBetSideStats(int $limit = 40): array
    {
        $stmt = $this->db->prepare(
            'SELECT recent.bet_side AS side,
                    COALESCE(SUM(recent.bet_amount),0) AS total_amount,
                    COUNT(*) AS bet_count
             FROM (SELECT bet_side, bet_amount FROM tai_xiu_bets ORDER BY id DESC LIMIT ?) AS recent
             GROUP BY recent.bet_side'
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getRoundResultStats(int $limit = 40): array
    {
        $stmt = $this->db->prepare(
            "SELECT recent.result_key, COUNT(*) AS total_rounds
             FROM (SELECT result_key FROM tai_xiu_rounds WHERE status='finished' ORDER BY id DESC LIMIT ?) AS recent
             GROUP BY recent.result_key"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
