<?php

namespace App\Services;

use App\Config\Database;
use App\Repositories\CaroRepository;
use App\Repositories\UserRepository;

class CaroService
{
    private const DEFAULT_BOARD_SIZE = 15;
    private const DEFAULT_WIN_LENGTH = 5;
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    private const CODE_LENGTH = 6;

    private CaroRepository $repo;
    private UserRepository $userRepo;

    public function __construct()
    {
        $this->repo = new CaroRepository();
        $this->userRepo = new UserRepository();
    }

    // ── Create room ─────────────────────────────────────────────────────

    public function createRoom(int $userId, array $opts): array
    {
        $name = isset($opts['name']) ? trim((string) $opts['name']) : null;
        if ($name !== null && $name === '') $name = null;
        if ($name !== null && mb_strlen($name) > 100) {
            $name = mb_substr($name, 0, 100);
        }

        $visibility = ($opts['visibility'] ?? 'private') === 'public' ? 'public' : 'private';
        $isMatchmaking = !empty($opts['is_matchmaking']) ? 1 : 0;

        // Password: chỉ apply cho phòng private không phải matchmaking
        $passwordHash = null;
        $rawPassword = isset($opts['password']) ? trim((string) $opts['password']) : '';
        if ($rawPassword !== '' && !$isMatchmaking) {
            if (mb_strlen($rawPassword) > 32) {
                throw new \RuntimeException('Mật khẩu phòng tối đa 32 ký tự.');
            }
            $passwordHash = password_hash($rawPassword, PASSWORD_BCRYPT);
        }

        $boardSize = isset($opts['board_size']) ? (int) $opts['board_size'] : self::DEFAULT_BOARD_SIZE;
        if ($boardSize < 9 || $boardSize > 19) $boardSize = self::DEFAULT_BOARD_SIZE;

        $winLength = isset($opts['win_length']) ? (int) $opts['win_length'] : self::DEFAULT_WIN_LENGTH;
        if ($winLength < 3 || $winLength > 6) $winLength = self::DEFAULT_WIN_LENGTH;

        $code = $this->generateUniqueCode();

        $id = $this->repo->createRoom([
            'code' => $code,
            'name' => $name,
            'password_hash' => $passwordHash,
            'visibility' => $visibility,
            'is_matchmaking' => $isMatchmaking,
            'creator_id' => $userId,
            'board_size' => $boardSize,
            'win_length' => $winLength,
            'board_state' => json_encode([]),
        ]);

        return $this->buildRoomPayload($this->repo->findById($id), $userId);
    }

    // ── Join by code ────────────────────────────────────────────────────

    public function joinByCode(int $userId, string $code, ?string $password): array
    {
        $code = strtoupper(trim($code));
        if ($code === '') throw new \RuntimeException('Vui lòng nhập mã phòng.');

        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            // SELECT FOR UPDATE bằng id sau khi tìm
            $room = $this->repo->findByCode($code);
            if (!$room) {
                throw new \RuntimeException('Không tìm thấy phòng với mã này.');
            }
            $room = $this->repo->findById((int) $room['id'], true);
            if (!$room) {
                throw new \RuntimeException('Không tìm thấy phòng với mã này.');
            }

            if ((int) $room['creator_id'] === $userId) {
                $db->commit();
                return $this->buildRoomPayload($room, $userId);
            }
            if ((int) ($room['opponent_id'] ?? 0) === $userId) {
                $db->commit();
                return $this->buildRoomPayload($room, $userId);
            }
            if ($room['status'] !== 'waiting' || $room['opponent_id'] !== null) {
                throw new \RuntimeException('Phòng đã đủ người hoặc đã kết thúc.');
            }
            if (!empty($room['password_hash'])) {
                if ($password === null || !password_verify($password, $room['password_hash'])) {
                    throw new \RuntimeException('Mật khẩu phòng không đúng.');
                }
            }

            $ok = $this->repo->joinRoom((int) $room['id'], $userId);
            if (!$ok) {
                throw new \RuntimeException('Không thể vào phòng. Có thể đã có người vào trước.');
            }

            $db->commit();
            $updated = $this->repo->findById((int) $room['id']);
            return $this->buildRoomPayload($updated, $userId);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // ── Random matchmaking ──────────────────────────────────────────────

    public function randomMatch(int $userId): array
    {
        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            $waiting = $this->repo->findOpenMatchmakingRoom($userId);
            if ($waiting) {
                $ok = $this->repo->joinRoom((int) $waiting['id'], $userId);
                if (!$ok) {
                    throw new \RuntimeException('Phòng ghép trận vừa bị người khác giành. Thử lại.');
                }
                $db->commit();
                $room = $this->repo->findById((int) $waiting['id']);
                return $this->buildRoomPayload($room, $userId);
            }

            // Không có phòng đợi → tạo phòng matchmaking mới
            $code = $this->generateUniqueCode();
            $id = $this->repo->createRoom([
                'code' => $code,
                'name' => 'Ghép trận ngẫu nhiên',
                'visibility' => 'public',
                'is_matchmaking' => 1,
                'creator_id' => $userId,
                'board_size' => self::DEFAULT_BOARD_SIZE,
                'win_length' => self::DEFAULT_WIN_LENGTH,
                'board_state' => json_encode([]),
            ]);

            $db->commit();
            return $this->buildRoomPayload($this->repo->findById($id), $userId);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    public function cancelMatchmaking(int $userId, int $roomId): bool
    {
        return $this->repo->deleteWaitingRoom($roomId, $userId);
    }

    // ── Make move ───────────────────────────────────────────────────────

    public function makeMove(int $userId, int $roomId, int $row, int $col): array
    {
        $db = Database::getConnection();
        $db->beginTransaction();
        try {
            $room = $this->repo->findById($roomId, true);
            if (!$room) throw new \RuntimeException('Phòng không tồn tại.');
            if ($room['status'] !== 'playing') {
                throw new \RuntimeException('Phòng chưa bắt đầu hoặc đã kết thúc.');
            }

            $creatorId = (int) $room['creator_id'];
            $opponentId = (int) ($room['opponent_id'] ?? 0);
            if ($userId !== $creatorId && $userId !== $opponentId) {
                throw new \RuntimeException('Bạn không thuộc phòng này.');
            }
            $mySymbol = $userId === $creatorId ? 'X' : 'O';
            if ($mySymbol !== $room['current_turn']) {
                throw new \RuntimeException('Chưa tới lượt của bạn.');
            }

            $boardSize = (int) $room['board_size'];
            if ($row < 0 || $col < 0 || $row >= $boardSize || $col >= $boardSize) {
                throw new \RuntimeException('Vị trí không hợp lệ.');
            }

            $moves = $this->decodeBoard($room['board_state']);
            $occupied = $this->buildOccupiedMap($moves);
            $key = $row . ':' . $col;
            if (isset($occupied[$key])) {
                throw new \RuntimeException('Ô đã được đánh.');
            }

            $moves[] = ['r' => $row, 'c' => $col, 's' => $mySymbol];
            $occupied[$key] = $mySymbol;

            $winLength = (int) $room['win_length'];
            $won = $this->checkWin($occupied, $row, $col, $mySymbol, $winLength, $boardSize);
            $isDraw = !$won && count($moves) >= ($boardSize * $boardSize);

            $boardJson = json_encode($moves);
            $moveCount = count($moves);
            $nextTurn = $mySymbol === 'X' ? 'O' : 'X';

            if ($won) {
                $this->repo->finishRoom($roomId, $mySymbol, $userId, $boardJson, $moveCount);
            } elseif ($isDraw) {
                $this->repo->finishRoom($roomId, 'draw', null, $boardJson, $moveCount);
            } else {
                $this->repo->applyMove($roomId, $boardJson, $moveCount, $nextTurn);
            }

            $db->commit();
            $updated = $this->repo->findById($roomId);
            return $this->buildRoomPayload($updated, $userId);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    // ── Resign / leave ──────────────────────────────────────────────────

    public function leaveRoom(int $userId, int $roomId): array
    {
        $room = $this->repo->findById($roomId);
        if (!$room) throw new \RuntimeException('Phòng không tồn tại.');

        $creatorId = (int) $room['creator_id'];
        $opponentId = (int) ($room['opponent_id'] ?? 0);
        $isCreator = $userId === $creatorId;
        $isOpponent = $userId === $opponentId;
        if (!$isCreator && !$isOpponent) {
            throw new \RuntimeException('Bạn không thuộc phòng này.');
        }

        if ($room['status'] === 'waiting' && $isCreator) {
            $this->repo->deleteWaitingRoom($roomId, $userId);
            return ['id' => $roomId, 'deleted' => true];
        }

        if ($room['status'] === 'playing') {
            $winnerUserId = $isCreator ? ($opponentId ?: null) : $creatorId;
            $winnerSymbol = $isCreator ? 'O' : 'X';
            $this->repo->abandonRoom($roomId, $winnerUserId, $winnerSymbol);
        }

        $updated = $this->repo->findById($roomId);
        return $this->buildRoomPayload($updated, $userId);
    }

    // ── Queries ─────────────────────────────────────────────────────────

    public function getRoom(int $userId, int $roomId): array
    {
        $room = $this->repo->findById($roomId);
        if (!$room) throw new \RuntimeException('Phòng không tồn tại.');
        return $this->buildRoomPayload($room, $userId);
    }

    public function getRoomByCode(int $userId, string $code): ?array
    {
        $room = $this->repo->findByCode(strtoupper(trim($code)));
        if (!$room) return null;
        return $this->buildRoomPayload($room, $userId);
    }

    public function listPublicRooms(int $userId, int $limit = 30): array
    {
        $rows = $this->repo->listOpenPublicRooms($limit);
        return array_map(fn($r) => $this->buildRoomPayload($r, $userId), $rows);
    }

    public function listMyActive(int $userId, int $limit = 10): array
    {
        $rows = $this->repo->listMyActiveRooms($userId, $limit);
        return array_map(fn($r) => $this->buildRoomPayload($r, $userId), $rows);
    }

    public function listMyHistory(int $userId, int $limit = 10): array
    {
        $rows = $this->repo->listMyRecentFinished($userId, $limit);
        return array_map(fn($r) => $this->buildRoomPayload($r, $userId), $rows);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private function generateUniqueCode(): string
    {
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = '';
            $alphaLen = strlen(self::CODE_ALPHABET);
            for ($i = 0; $i < self::CODE_LENGTH; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, $alphaLen - 1)];
            }
            if (!$this->repo->codeExists($code)) return $code;
        }
        throw new \RuntimeException('Không thể tạo mã phòng. Vui lòng thử lại.');
    }

    private function decodeBoard(?string $json): array
    {
        if (!$json) return [];
        $arr = json_decode($json, true);
        return is_array($arr) ? $arr : [];
    }

    private function buildOccupiedMap(array $moves): array
    {
        $map = [];
        foreach ($moves as $m) {
            if (!isset($m['r'], $m['c'], $m['s'])) continue;
            $map[$m['r'] . ':' . $m['c']] = $m['s'];
        }
        return $map;
    }

    /**
     * Kiểm tra thắng từ ô vừa đánh: đếm số liên tiếp 4 hướng (ngang, dọc, 2 chéo).
     */
    private function checkWin(array $occupied, int $row, int $col, string $symbol, int $winLength, int $boardSize): bool
    {
        $directions = [
            [0, 1],   // ngang
            [1, 0],   // dọc
            [1, 1],   // chéo \
            [1, -1],  // chéo /
        ];

        foreach ($directions as [$dr, $dc]) {
            $count = 1;
            // Tới phía dương
            $r = $row + $dr; $c = $col + $dc;
            while ($r >= 0 && $c >= 0 && $r < $boardSize && $c < $boardSize && ($occupied[$r . ':' . $c] ?? null) === $symbol) {
                $count++;
                $r += $dr; $c += $dc;
            }
            // Tới phía âm
            $r = $row - $dr; $c = $col - $dc;
            while ($r >= 0 && $c >= 0 && $r < $boardSize && $c < $boardSize && ($occupied[$r . ':' . $c] ?? null) === $symbol) {
                $count++;
                $r -= $dr; $c -= $dc;
            }
            if ($count >= $winLength) return true;
        }
        return false;
    }

    private function buildRoomPayload(array $room, int $viewerId): array
    {
        $creator = $this->loadPlayer((int) $room['creator_id']);
        $opponent = $room['opponent_id'] ? $this->loadPlayer((int) $room['opponent_id']) : null;
        $moves = $this->decodeBoard($room['board_state'] ?? null);

        $viewerSymbol = null;
        if ($viewerId === (int) $room['creator_id']) $viewerSymbol = 'X';
        elseif ($room['opponent_id'] && $viewerId === (int) $room['opponent_id']) $viewerSymbol = 'O';

        $isMyTurn = $viewerSymbol !== null
            && $room['status'] === 'playing'
            && $viewerSymbol === $room['current_turn'];

        return [
            'id'             => (int) $room['id'],
            'code'           => (string) $room['code'],
            'name'           => $room['name'] ?? null,
            'has_password'   => !empty($room['password_hash']),
            'visibility'     => (string) $room['visibility'],
            'is_matchmaking' => (bool) $room['is_matchmaking'],
            'status'         => (string) $room['status'],
            'current_turn'   => (string) $room['current_turn'],
            'board_size'     => (int) $room['board_size'],
            'win_length'     => (int) $room['win_length'],
            'move_count'     => (int) $room['move_count'],
            'moves'          => $moves,
            'winner_symbol'  => $room['winner_symbol'] ?? null,
            'winner_user_id' => $room['winner_user_id'] ? (int) $room['winner_user_id'] : null,
            'creator'        => $creator,
            'opponent'       => $opponent,
            'viewer_symbol'  => $viewerSymbol,
            'is_my_turn'     => $isMyTurn,
            'created_at'     => $room['created_at'] ?? null,
            'updated_at'     => $room['updated_at'] ?? null,
            'last_move_at'   => $room['last_move_at'] ?? null,
        ];
    }

    private function loadPlayer(int $userId): ?array
    {
        $user = $this->userRepo->findById($userId);
        if (!$user) return null;
        return [
            'id'         => (int) $user['id'],
            'username'   => $user['username'] ?? '',
            'custom_url' => $user['custom_url'] ?? null,
            'avatar'     => $user['avatar'] ?? null,
        ];
    }
}
