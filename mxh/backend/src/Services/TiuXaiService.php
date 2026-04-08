<?php

namespace App\Services;

use App\Repositories\TiuXaiRepository;

class TiuXaiService
{
    private TiuXaiRepository $repo;

    // Phase durations in seconds (fixed)
    private const LOCK_DUR   = 2;
    private const ROLL_DUR   = 8;  // 6s animation + 2s buffer
    private const RESULT_DUR = 5;
    private const REWARD_DUR = 3;

    public function __construct()
    {
        $this->repo = new TiuXaiRepository();
    }

    // ---- Config ----

    public function getConfig(): array
    {
        $cfg = $this->repo->getConfig();
        return [
            'bet_duration'       => (int)($cfg['bet_duration'] ?? 30),
            'min_bet'            => (int)($cfg['min_bet'] ?? 10000),
            'max_bet'            => (int)($cfg['max_bet'] ?? 10000000),
            'win_multiplier'     => (int)($cfg['win_multiplier'] ?? 195),
            'jackpot_contrib_pct'=> (int)($cfg['jackpot_contrib_pct'] ?? 1),
            'jackpot_min_pool'   => (int)($cfg['jackpot_min_pool'] ?? 50000000),
        ];
    }

    public function updateConfig(array $data): void
    {
        $allowed = ['bet_duration', 'min_bet', 'max_bet', 'win_multiplier', 'jackpot_contrib_pct', 'jackpot_min_pool'];
        foreach ($allowed as $key) {
            if (isset($data[$key])) {
                $this->repo->setConfig($key, (string)(int)$data[$key]);
            }
        }
    }

    // ---- State machine helpers ----

    private function computeState(int $elapsed, int $betDur): string
    {
        if ($elapsed < $betDur)                                         return 'betting';
        if ($elapsed < $betDur + self::LOCK_DUR)                        return 'locked';
        if ($elapsed < $betDur + self::LOCK_DUR + self::ROLL_DUR)       return 'rolling';
        if ($elapsed < $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR) return 'result';
        if ($elapsed < $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR + self::REWARD_DUR) return 'reward';
        return 'done';
    }

    private function timeRemaining(int $elapsed, string $state, int $betDur): int
    {
        $boundaries = [
            'betting' => $betDur,
            'locked'  => $betDur + self::LOCK_DUR,
            'rolling' => $betDur + self::LOCK_DUR + self::ROLL_DUR,
            'result'  => $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR,
            'reward'  => $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR + self::REWARD_DUR,
        ];
        $end = $boundaries[$state] ?? $betDur;
        return max(0, $end - $elapsed);
    }

    private function advanceSessionIfNeeded(): void
    {
        $session = $this->repo->getLatestSession();
        if (!$session) {
            $this->repo->createSession();
            return;
        }

        $cfg     = $this->getConfig();
        $betDur  = $cfg['bet_duration'];
        $elapsed = time() - strtotime($session['created_at']);
        $state   = $this->computeState($elapsed, $betDur);

        // Generate dice when rolling starts (idempotent)
        $rollStart = $betDur + self::LOCK_DUR;
        if ($elapsed >= $rollStart && $session['dice1'] === null) {
            $this->generateDice($session['id']);
            $session = $this->repo->getLatestSession(); // refresh
        }

        // Process rewards once
        $rewardStart = $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR;
        if ($elapsed >= $rewardStart && !$session['reward_processed']) {
            $this->processRewards($session, $cfg);
        }

        // Create new session when cycle complete
        $cycleEnd = $betDur + self::LOCK_DUR + self::ROLL_DUR + self::RESULT_DUR + self::REWARD_DUR;
        if ($elapsed >= $cycleEnd) {
            $this->repo->createSession();
        }
    }

    private function generateDice(int $sessionId): void
    {
        try {
            $this->repo->beginTransaction();
            $locked = $this->repo->lockSessionForUpdate($sessionId);
            if ($locked && $locked['dice1'] === null) {
                $jackpot = $this->repo->getJackpotPool();
                $this->repo->setDice($sessionId, rand(1, 6), rand(1, 6), rand(1, 6), $jackpot);
            }
            $this->repo->commit();
        } catch (\Throwable $e) {
            $this->repo->rollBack();
        }
    }

    private function processRewards(array $session, array $cfg): void
    {
        try {
            $this->repo->beginTransaction();
            $locked = $this->repo->lockSessionForUpdate($session['id']);
            if (!$locked || $locked['reward_processed']) {
                $this->repo->rollBack();
                return;
            }

            $winSide   = $locked['result'];
            $bets      = $this->repo->getSessionBets($locked['id']);
            $multiplier= $cfg['win_multiplier']; // 195 = 1.95x
            $minPool   = $cfg['jackpot_min_pool'];
            $isJackpot = (bool)$locked['is_jackpot'];
            $jackpotSnap = (int)$locked['jackpot_snapshot'];

            // Total winning bet for proportional jackpot split
            $totalWinBet = 0;
            foreach ($bets as $bet) {
                if ($bet['side'] === $winSide) {
                    $totalWinBet += (int)$bet['amount'];
                }
            }

            foreach ($bets as $bet) {
                if ($bet['side'] === $winSide) {
                    $winAmount = (int)((int)$bet['amount'] * $multiplier / 100);
                    if ($isJackpot && $jackpotSnap > 0 && $totalWinBet > 0) {
                        $winAmount += (int)($jackpotSnap * (int)$bet['amount'] / $totalWinBet);
                    }
                    $this->repo->updateBet((int)$bet['id'], 'won', $winAmount);
                    $this->repo->addBalance((int)$bet['user_id'], $winAmount);
                } else {
                    $this->repo->updateBet((int)$bet['id'], 'lost', 0);
                }
            }

            if ($isJackpot && $jackpotSnap > 0) {
                $this->repo->payoutJackpot($jackpotSnap, $minPool);
            }

            $this->repo->markRewardProcessed($locked['id']);
            $this->repo->commit();
        } catch (\Throwable $e) {
            $this->repo->rollBack();
        }
    }

    // ---- Public API ----

    public function getCurrentSession(?int $userId = null): array
    {
        $this->advanceSessionIfNeeded();

        $session = $this->repo->getLatestSession();
        if (!$session) {
            $this->repo->createSession();
            $session = $this->repo->getLatestSession();
        }

        $cfg     = $this->getConfig();
        $betDur  = $cfg['bet_duration'];
        $elapsed = time() - strtotime($session['created_at']);
        $state   = $this->computeState($elapsed, $betDur);
        $remaining = $this->timeRemaining($elapsed, $state, $betDur);

        // Show dice only when rolling or later
        $rollStart = $betDur + self::LOCK_DUR;
        $showDice  = $elapsed >= $rollStart && $session['dice1'] !== null;

        $jackpotPool = $this->repo->getJackpotPool();

        $myBet = null;
        if ($userId) {
            $bet = $this->repo->getUserBet((int)$session['id'], $userId);
            if ($bet) {
                $myBet = [
                    'side'       => $bet['side'],
                    'amount'     => (int)$bet['amount'],
                    'win_amount' => (int)$bet['win_amount'],
                    'status'     => $bet['status'],
                ];
            }
        }

        // MD5 for provably fair (shown after result)
        $md5 = '';
        if ($showDice) {
            $md5 = md5($session['id'] . ':' . $session['dice1'] . $session['dice2'] . $session['dice3']);
        }

        return [
            'session' => [
                'id'               => (int)$session['id'],
                'state'            => $state,
                'time_remaining'   => $remaining,
                'dice'             => $showDice ? [(int)$session['dice1'], (int)$session['dice2'], (int)$session['dice3']] : [null, null, null],
                'total'            => $showDice ? (int)$session['total_points'] : null,
                'result'           => $showDice ? $session['result'] : null,
                'is_jackpot'       => $showDice ? (bool)$session['is_jackpot'] : false,
                'total_bet_tiu'    => (int)$session['total_bet_tiu'],
                'total_bet_xai'    => (int)$session['total_bet_xai'],
                'player_count_tiu' => (int)$session['player_count_tiu'],
                'player_count_xai' => (int)$session['player_count_xai'],
                'jackpot_pool'     => $jackpotPool,
                'my_bet'           => $myBet,
                'md5'              => $md5,
            ],
            'config' => [
                'bet_duration'  => $betDur,
                'min_bet'       => $cfg['min_bet'],
                'max_bet'       => $cfg['max_bet'],
                'win_multiplier'=> $cfg['win_multiplier'],
            ],
        ];
    }

    public function placeBet(int $userId, string $side, int $amount): array
    {
        $this->advanceSessionIfNeeded();

        if (!in_array($side, ['tiu', 'xai'])) {
            throw new \RuntimeException('Cửa cược không hợp lệ', 400);
        }

        $cfg = $this->getConfig();
        if ($amount < $cfg['min_bet'] || $amount > $cfg['max_bet']) {
            throw new \RuntimeException(
                'Mức cược từ ' . number_format($cfg['min_bet']) . ' đến ' . number_format($cfg['max_bet']) . ' VND',
                400
            );
        }

        $this->repo->beginTransaction();
        try {
            $session = $this->repo->lockSessionForUpdate(
                (int)$this->repo->getLatestSession()['id']
            );

            $elapsed = time() - strtotime($session['created_at']);
            $state   = $this->computeState($elapsed, $cfg['bet_duration']);
            if ($state !== 'betting') {
                throw new \RuntimeException('Phiên hiện tại đã hết thời gian đặt cược', 400);
            }

            // Check existing bet (one bet per user per session)
            $existing = $this->repo->getUserBet((int)$session['id'], $userId);
            if ($existing && $existing['side'] !== $side) {
                throw new \RuntimeException('Bạn đã đặt cược cửa ' . strtoupper($existing['side'] === 'tiu' ? 'Tỉu' : 'Xài') . ' trong phiên này', 400);
            }
            $existingAmount = $existing ? (int)$existing['amount'] : 0;
            if ($existingAmount + $amount > $cfg['max_bet']) {
                throw new \RuntimeException('Tổng cược vượt quá giới hạn ' . number_format($cfg['max_bet']) . ' VND', 400);
            }

            // Deduct balance (jackpot contribution taken from this)
            $jackpotContrib = (int)($amount * $cfg['jackpot_contrib_pct'] / 100);
            $netAmount = $amount - $jackpotContrib;

            $ok = $this->repo->deductBalance($userId, $amount);
            if (!$ok) {
                throw new \RuntimeException('Số dư không đủ', 400);
            }

            // Add jackpot contribution
            if ($jackpotContrib > 0) {
                $this->repo->addToJackpot($jackpotContrib);
            }

            // Create or merge bet
            $isNew = !$existing;
            if ($existing) {
                $this->repo->addToBet((int)$existing['id'], $netAmount);
            } else {
                $this->repo->createBet((int)$session['id'], $userId, $side, $netAmount);
            }
            $this->repo->updateSessionTotals((int)$session['id'], $side, $netAmount, $isNew ? 1 : 0);

            $newBalance = $this->repo->getBalanceNoLock($userId);
            $this->repo->commit();

            return ['balance' => $newBalance];
        } catch (\Throwable $e) {
            $this->repo->rollBack();
            throw $e;
        }
    }

    public function getSessionHistory(int $page = 1): array
    {
        $limit  = 20;
        $offset = ($page - 1) * $limit;
        $rows   = $this->repo->getSessionHistory($limit, $offset);
        $total  = $this->repo->countCompletedSessions();

        return [
            'sessions'   => $rows,
            'total'      => $total,
            'page'       => $page,
            'total_pages'=> (int)ceil($total / $limit),
        ];
    }

    public function getPlayerBetHistory(int $userId, int $page = 1): array
    {
        $limit  = 20;
        $offset = ($page - 1) * $limit;
        $rows   = $this->repo->getPlayerBetHistory($userId, $limit, $offset);
        return ['bets' => $rows];
    }

    public function getAdminSessions(int $page = 1): array
    {
        $limit  = 30;
        $offset = ($page - 1) * $limit;
        return [
            'sessions'    => $this->repo->getAllSessions($limit, $offset),
            'total'       => $this->repo->countAllSessions(),
            'page'        => $page,
            'total_pages' => (int)ceil($this->repo->countAllSessions() / $limit),
        ];
    }

    public function getAdminBets(int $page = 1): array
    {
        $limit  = 30;
        $offset = ($page - 1) * $limit;
        return [
            'bets'        => $this->repo->getAllBets($limit, $offset),
            'total'       => $this->repo->countAllBets(),
            'page'        => $page,
            'total_pages' => (int)ceil($this->repo->countAllBets() / $limit),
        ];
    }

    public function getJackpotPool(): int
    {
        return $this->repo->getJackpotPool();
    }
}
