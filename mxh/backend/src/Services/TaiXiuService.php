<?php

namespace App\Services;

use App\Config\Database;
use App\Repositories\TaiXiuRepository;
use App\Repositories\TransactionRepository;

class TaiXiuService
{
    private const BASE_JACKPOT_POOL = 50000;
    private const MIN_BET           = 10000;
    private const BET_WINDOW        = 30; // giây mỗi phiên

    private TaiXiuRepository  $repo;
    private TransactionRepository $transactionRepo;

    public function __construct()
    {
        $this->repo            = new TaiXiuRepository();
        $this->transactionRepo = new TransactionRepository();
    }

    // ── Public: lấy phiên hiện tại (dùng cho polling frontend) ──────────

    public function getCurrentRound(int $userId): array
    {
        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // Resolve bất kỳ phiên nào đã hết giờ trước
            $this->resolveExpiredRound($db);

            // Lấy hoặc tạo phiên betting mới
            $round = $this->repo->getOrCreateCurrentRound(self::BET_WINDOW, true);

            $db->commit();

            return $this->buildCurrentRoundPayload($round, $userId);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // ── Public: đặt cược (server-round) ─────────────────────────────────

    public function placeBet(int $userId, string $side, int $amount): array
    {
        $side = strtolower(trim($side));
        if (!in_array($side, ['tai', 'xiu'], true)) {
            throw new \RuntimeException('Cửa cược không hợp lệ.');
        }
        if ($amount < self::MIN_BET) {
            throw new \RuntimeException('Mức cược tối thiểu là 10.000đ.');
        }

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // Resolve phiên hết giờ trước
            $this->resolveExpiredRound($db);

            $round = $this->repo->getOrCreateCurrentRound(self::BET_WINDOW, true);
            if ($round['status'] !== 'betting') {
                throw new \RuntimeException('Phiên đã kết thúc, vui lòng đợi phiên mới.');
            }

            // Kiểm tra user chưa cược phiên này
            $existing = $this->repo->getUserBetForRound((int)$round['id'], $userId);
            if ($existing) {
                throw new \RuntimeException('Bạn đã đặt cược phiên này rồi.');
            }

            // Kiểm tra số dư
            $balance = $this->transactionRepo->getBalanceForUpdate($userId);
            if ($balance < $amount) {
                throw new \RuntimeException('Số dư không đủ để đặt cược.');
            }

            // Trừ tiền ngay (sẽ hoàn/thưởng khi resolve)
            $this->transactionRepo->addBalance($userId, -$amount);

            $this->repo->createPendingBet((int)$round['id'], $userId, $side, $amount);

            $newBalance = $balance - $amount;
            $db->commit();

            $updatedRound = $this->repo->getRoundById((int)$round['id']);
            return [
                'balance'       => $newBalance,
                'current_round' => $this->buildCurrentRoundPayload($updatedRound, $userId),
            ];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // ── Public: overview tổng hợp (vẫn dùng cho history/jackpot) ────────

    public function getOverview(int $userId, int $roundLimit = 18, int $betLimit = 12, int $jackpotLimit = 10): array
    {
        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            $this->resolveExpiredRound($db);
            $round = $this->repo->getOrCreateCurrentRound(self::BET_WINDOW, true);
            $db->commit();

            $balance       = $this->transactionRepo->getBalance($userId);
            $jackpotState  = $this->repo->getJackpotState();
            $recentRounds  = array_map([$this, 'mapRound'], $this->repo->getRecentRounds($roundLimit));
            $recentBets    = array_map([$this, 'mapBet'],   $this->repo->getBetHistoryByUser($userId, $betLimit, 0));
            $jackpotHistory = array_map([$this, 'mapRound'], $this->repo->getJackpotHistory($jackpotLimit));

            $taiRounds = 0; $xiuRounds = 0;
            foreach ($this->repo->getRoundResultStats() as $row) {
                if (($row['result_key'] ?? '') === 'xiu') $xiuRounds = (int)$row['total_rounds'];
                else $taiRounds = (int)$row['total_rounds'];
            }
            $totalRounds = $taiRounds + $xiuRounds;
            $taiRate = $totalRounds > 0 ? (int) round(($taiRounds / $totalRounds) * 100) : 50;

            return [
                'balance'           => $balance,
                'jackpot_tai_pool'  => (int)($jackpotState['tai_pool']  ?? self::BASE_JACKPOT_POOL),
                'jackpot_xiu_pool'  => (int)($jackpotState['xiu_pool']  ?? self::BASE_JACKPOT_POOL),
                'tai_result_rate'   => $taiRate,
                'xiu_result_rate'   => 100 - $taiRate,
                'recent_rounds'     => $recentRounds,
                'my_recent_bets'    => $recentBets,
                'jackpot_history'   => $jackpotHistory,
                'current_round'     => $this->buildCurrentRoundPayload($round, $userId),
            ];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // ── Internal: resolve phiên hết giờ (gọi đầu mỗi request) ──────────

    private function resolveExpiredRound(\PDO $db): void
    {
        $expired = $this->repo->getExpiredBettingRound();
        if (!$expired) return;

        $roundId      = (int)$expired['id'];
        $pendingBets  = $this->repo->getPendingBetsByRound($roundId);

        $jackpotState = $this->repo->getJackpotState(true);
        $taiPool  = (int)($jackpotState['tai_pool']  ?? self::BASE_JACKPOT_POOL);
        $xiuPool  = (int)($jackpotState['xiu_pool']  ?? self::BASE_JACKPOT_POOL);

        // Cộng vào pool từ tất cả cược
        foreach ($pendingBets as $bet) {
            $contribution = max(1000, (int) floor((int)$bet['bet_amount'] * 0.05));
            if ($bet['bet_side'] === 'tai') $taiPool += $contribution;
            else $xiuPool += $contribution;
        }

        $dice      = $this->rollDice();
        $total     = array_sum($dice);
        $resultKey = $total >= 11 ? 'tai' : 'xiu';
        $jackpotSide   = null;
        $jackpotPayout = 0;

        // Jackpot
        if ($total === 18) {
            $jackpotSide   = 'tai';
            $jackpotPayout = $taiPool;
            $taiPool       = self::BASE_JACKPOT_POOL;
        } elseif ($total === 3) {
            $jackpotSide   = 'xiu';
            $jackpotPayout = $xiuPool;
            $xiuPool       = self::BASE_JACKPOT_POOL;
        }

        $md5Hash = md5(implode('|', [(int)$expired['round_code'], ...$dice, microtime(true), bin2hex(random_bytes(4))]));

        // Update round
        $this->repo->resolveRound($roundId, $dice, $total, $resultKey, $jackpotSide, $jackpotPayout, $taiPool, $xiuPool, $md5Hash);
        $this->repo->updateJackpotState($taiPool, $xiuPool);

        // Resolve each bet
        foreach ($pendingBets as $bet) {
            $userId     = (int)$bet['user_id'];
            $betAmount  = (int)$bet['bet_amount'];
            $betSide    = $bet['bet_side'];
            $didWin     = $betSide === $resultKey;
            $myJackpot  = ($didWin && $jackpotSide === $betSide) ? (int)round($jackpotPayout * ($betAmount / max(1, $this->getTotalBetForSide($pendingBets, $betSide)))) : 0;

            $netAmount   = $didWin ? $betAmount : 0; // trừ tiền đã trừ khi bet, nên thắng = +amount, thua = 0 thêm
            $netAmount  += $myJackpot;
            // Khôi phục vốn nếu thắng
            $payout      = $didWin ? $betAmount * 2 + $myJackpot : $myJackpot;

            $currentBalance = $this->transactionRepo->getBalanceForUpdate($userId);
            $balanceAfter   = $currentBalance + $payout;

            $this->transactionRepo->addBalance($userId, $payout);

            $this->repo->resolveBet(
                (int)$bet['id'],
                $resultKey,
                $didWin,
                $didWin ? $betAmount + $myJackpot : -$betAmount,
                $balanceAfter,
                $myJackpot > 0,
                $myJackpot
            );

            $txnRef = 'TAIXIU-' . $expired['round_code'] . '-' . $userId . '-' . $bet['id'];
            $desc   = $this->buildTxnDesc((int)$expired['round_code'], $betSide, $resultKey, $didWin ? $betAmount : -$betAmount, $myJackpot);
            $this->transactionRepo->createCompleted($userId, $txnRef, $payout - $betAmount, $desc);
        }
    }

    private function getTotalBetForSide(array $bets, string $side): int
    {
        $total = 0;
        foreach ($bets as $b) {
            if ($b['bet_side'] === $side) $total += (int)$b['bet_amount'];
        }
        return $total;
    }

    // ── Internal: build current_round payload ────────────────────────────

    private function buildCurrentRoundPayload(?array $round, int $userId): array
    {
        if (!$round) {
            return [
                'id'              => 0,
                'round_code'      => '',
                'status'          => 'finished',
                'seconds_left'    => 0,
                'betting_deadline'=> '',
                'tai_total'       => 0,
                'tai_count'       => 0,
                'xiu_total'       => 0,
                'xiu_count'       => 0,
                'dice'            => [],
                'total'           => 0,
                'result_key'      => '',
                'result_label'    => '',
                'my_bet_side'     => '',
                'my_bet_amount'   => 0,
                'my_did_win'      => null,
                'jackpot_payout'  => 0,
            ];
        }

        $stats    = $this->repo->getRoundBetStats((int)$round['id']);
        $myBet    = $this->repo->getUserBetForRound((int)$round['id'], $userId);
        $deadline = $round['betting_deadline'] ? strtotime($round['betting_deadline']) : 0;
        $secsLeft = max(0, $deadline - time());

        return [
            'id'               => (int)$round['id'],
            'round_code'       => (string)$round['round_code'],
            'status'           => (string)$round['status'],
            'seconds_left'     => (int)$secsLeft,
            'betting_deadline' => (string)($round['betting_deadline'] ?? ''),
            'tai_total'        => (int)$stats['tai_total'],
            'tai_count'        => (int)$stats['tai_count'],
            'xiu_total'        => (int)$stats['xiu_total'],
            'xiu_count'        => (int)$stats['xiu_count'],
            'dice'             => $round['dice_1'] !== null
                                    ? [(int)$round['dice_1'], (int)$round['dice_2'], (int)$round['dice_3']]
                                    : [],
            'total'            => $round['total'] !== null ? (int)$round['total'] : 0,
            'result_key'       => (string)($round['result_key'] ?? ''),
            'result_label'     => $round['result_key'] ? $this->labelForSide((string)$round['result_key']) : '',
            'my_bet_side'      => $myBet ? (string)$myBet['bet_side'] : '',
            'my_bet_amount'    => $myBet ? (int)$myBet['bet_amount'] : 0,
            'my_did_win'       => $myBet && $myBet['did_win'] !== null ? (bool)$myBet['did_win'] : null,
            'jackpot_payout'   => $round['jackpot_payout'] !== null ? (int)$round['jackpot_payout'] : 0,
        ];
    }

    // ── History helpers ──────────────────────────────────────────────────

    public function getBetHistory(int $userId, int $limit = 20, int $page = 1): array
    {
        $offset = max(0, ($page - 1) * $limit);
        return array_map([$this, 'mapBet'], $this->repo->getBetHistoryByUser($userId, $limit, $offset));
    }

    public function getRoundHistory(int $limit = 20): array
    {
        return array_map([$this, 'mapRound'], $this->repo->getRecentRounds($limit));
    }

    public function getJackpotHistory(int $limit = 20): array
    {
        return array_map([$this, 'mapRound'], $this->repo->getJackpotHistory($limit));
    }

    // ── Dice ────────────────────────────────────────────────────────────

    private function rollDice(): array
    {
        return [random_int(1, 6), random_int(1, 6), random_int(1, 6)];
    }

    // ── Mapping ─────────────────────────────────────────────────────────

    private function mapRound(array $row): array
    {
        return [
            'id'               => (int)$row['id'],
            'round_code'       => (string)$row['round_code'],
            'md5_hash'         => (string)($row['md5_hash'] ?? ''),
            'dice'             => [(int)($row['dice_1'] ?? 0), (int)($row['dice_2'] ?? 0), (int)($row['dice_3'] ?? 0)],
            'total'            => (int)($row['total'] ?? 0),
            'result_key'       => (string)($row['result_key'] ?? ''),
            'result_label'     => $row['result_key'] ? $this->labelForSide((string)$row['result_key']) : '',
            'jackpot_side'     => $row['jackpot_side'] ? (string)$row['jackpot_side'] : null,
            'jackpot_payout'   => (int)($row['jackpot_payout'] ?? 0),
            'tai_pool_snapshot'=> (int)($row['tai_pool_snapshot'] ?? 0),
            'xiu_pool_snapshot'=> (int)($row['xiu_pool_snapshot'] ?? 0),
            'created_at'       => (string)($row['created_at'] ?? ''),
        ];
    }

    private function mapBet(array $row): array
    {
        return [
            'id'           => (int)$row['id'],
            'round_id'     => (int)$row['round_id'],
            'round_code'   => (string)($row['round_code'] ?? ''),
            'md5_hash'     => (string)($row['md5_hash'] ?? ''),
            'bet_side'     => (string)$row['bet_side'],
            'bet_label'    => $this->labelForSide((string)$row['bet_side']),
            'bet_amount'   => (int)$row['bet_amount'],
            'result_key'   => (string)($row['result_key'] ?? ''),
            'result_label' => $row['result_key'] ? $this->labelForSide((string)$row['result_key']) : '',
            'dice'         => [(int)($row['dice_1'] ?? 0), (int)($row['dice_2'] ?? 0), (int)($row['dice_3'] ?? 0)],
            'total'        => (int)($row['total'] ?? 0),
            'did_win'      => (bool)($row['did_win'] ?? false),
            'net_amount'   => (int)($row['net_amount'] ?? 0),
            'balance_after'=> (int)($row['balance_after'] ?? 0),
            'jackpot_hit'  => (bool)($row['jackpot_hit'] ?? false),
            'jackpot_payout'=> (int)($row['jackpot_payout'] ?? 0),
            'created_at'   => (string)($row['created_at'] ?? ''),
        ];
    }

    private function labelForSide(string $side): string
    {
        return $side === 'xiu' ? 'Xỉu' : 'Tài';
    }

    private function buildTxnDesc(int $roundCode, string $betSide, string $resultKey, int $netAmount, int $jackpotPayout): string
    {
        $status = $netAmount >= 0 ? 'thắng' : 'thua';
        $parts  = ['Tài Xỉu #' . $roundCode, 'Cược ' . $this->labelForSide($betSide), 'ra ' . $this->labelForSide($resultKey), $status];
        if ($jackpotPayout > 0) $parts[] = 'nổ hũ +' . number_format($jackpotPayout, 0, ',', '.');
        return implode(' • ', $parts);
    }
}
