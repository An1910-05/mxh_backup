<?php

namespace App\Controllers;

use App\Services\TiuXaiService;
use App\Middleware\AuthMiddleware;
use App\Helpers\Response;

class TiuXaiController
{
    private TiuXaiService $service;

    public function __construct()
    {
        $this->service = new TiuXaiService();
    }

    /** GET /game/tiu-xai/session */
    public function getSession(): void
    {
        $user = AuthMiddleware::optionalAuth();
        $data = $this->service->getCurrentSession($user ? (int)$user['id'] : null);
        Response::success($data);
    }

    /** POST /game/tiu-xai/bet */
    public function placeBet(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $side   = $body['side'] ?? '';
        $amount = (int)($body['amount'] ?? 0);

        try {
            $result = $this->service->placeBet((int)$user['id'], $side, $amount);
            Response::success($result, 'Đặt cược thành công');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 400);
        }
    }

    /** GET /game/tiu-xai/history */
    public function getHistory(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        Response::success($this->service->getSessionHistory($page));
    }

    /** GET /game/tiu-xai/my-bets */
    public function getMyBets(): void
    {
        $user = AuthMiddleware::authenticate();
        $page = max(1, (int)($_GET['page'] ?? 1));
        Response::success($this->service->getPlayerBetHistory((int)$user['id'], $page));
    }

    /** GET /game/tiu-xai/config */
    public function getConfig(): void
    {
        Response::success($this->service->getConfig());
    }

    /** GET /admin/game/tiu-xai/config */
    public function adminGetConfig(): void
    {
        $this->requireAdmin();
        $cfg = $this->service->getConfig();
        $cfg['jackpot_pool'] = $this->service->getJackpotPool();
        Response::success($cfg);
    }

    /** POST /admin/game/tiu-xai/config */
    public function adminUpdateConfig(): void
    {
        $this->requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $this->service->updateConfig($data);
        Response::success([], 'Cập nhật cấu hình thành công');
    }

    /** GET /admin/game/tiu-xai/sessions */
    public function adminGetSessions(): void
    {
        $this->requireAdmin();
        $page = max(1, (int)($_GET['page'] ?? 1));
        Response::success($this->service->getAdminSessions($page));
    }

    /** GET /admin/game/tiu-xai/bets */
    public function adminGetBets(): void
    {
        $this->requireAdmin();
        $page = max(1, (int)($_GET['page'] ?? 1));
        Response::success($this->service->getAdminBets($page));
    }

    private function requireAdmin(): array
    {
        $user = AuthMiddleware::authenticate();
        $adminIds = array_map('intval', explode(',', $_ENV['ADMIN_USER_IDS'] ?? '1'));
        if (!in_array((int)$user['id'], $adminIds)) {
            Response::error('Forbidden', 403);
            exit;
        }
        return $user;
    }
}
