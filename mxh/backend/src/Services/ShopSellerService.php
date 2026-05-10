<?php

namespace App\Services;

use App\Repositories\ShopSellerApplicationRepository;
use Exception;

class ShopSellerService
{
    private ShopSellerApplicationRepository $repo;

    public function __construct()
    {
        $this->repo = new ShopSellerApplicationRepository();
    }

    public function getMyApplication(int $userId): ?array
    {
        return $this->repo->findByUserId($userId);
    }

    public function listPending(int $limit = 50, int $page = 1): array
    {
        $offset = max(0, ($page - 1) * $limit);
        return $this->repo->listByStatus('pending', $limit, $offset);
    }

    public function listByStatus(string $status, int $limit = 50, int $page = 1): array
    {
        if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
            throw new Exception('Invalid status', 400);
        }
        $offset = max(0, ($page - 1) * $limit);
        return $this->repo->listByStatus($status, $limit, $offset);
    }

    public function register(int $userId, array $data): array
    {
        $storeName = trim((string)($data['store_name'] ?? ''));
        $intro = trim((string)($data['intro'] ?? ''));
        $phone = trim((string)($data['phone'] ?? ''));
        $address = trim((string)($data['address'] ?? ''));

        if ($storeName === '' || mb_strlen($storeName) > 100) {
            throw new Exception('Tên cửa hàng bắt buộc, tối đa 100 ký tự', 400);
        }
        if ($intro === '' || mb_strlen($intro) > 1000) {
            throw new Exception('Giới thiệu bắt buộc, tối đa 1000 ký tự', 400);
        }
        if ($phone === '' || mb_strlen($phone) > 30) {
            throw new Exception('Số điện thoại bắt buộc, tối đa 30 ký tự', 400);
        }
        if ($address === '' || mb_strlen($address) > 255) {
            throw new Exception('Địa chỉ bắt buộc, tối đa 255 ký tự', 400);
        }

        if ($this->repo->userIsSeller($userId)) {
            throw new Exception('Tài khoản đã là người bán', 409);
        }

        $existing = $this->repo->findByUserId($userId);

        if ($existing) {
            if ($existing['status'] === 'pending') {
                throw new Exception('Đơn đăng ký đang chờ duyệt', 409);
            }
            if ($existing['status'] === 'approved') {
                throw new Exception('Đơn đăng ký đã được duyệt', 409);
            }
            // rejected -> resubmit using same row
            $this->repo->resubmit((int)$existing['id'], $storeName, $intro, $phone, $address);
            return $this->repo->findByUserId($userId);
        }

        $this->repo->insert($userId, $storeName, $intro, $phone, $address);
        return $this->repo->findByUserId($userId);
    }

    public function approve(int $applicationId, int $reviewerId): array
    {
        $app = $this->repo->findById($applicationId);
        if (!$app) {
            throw new Exception('Không tìm thấy đơn đăng ký', 404);
        }
        if ($app['status'] !== 'pending') {
            throw new Exception('Chỉ có thể duyệt đơn đang chờ', 400);
        }
        $this->repo->approve($applicationId, $reviewerId);
        $this->repo->setUserIsSeller((int)$app['user_id'], true);
        return $this->repo->findById($applicationId);
    }

    public function reject(int $applicationId, int $reviewerId, string $reason): array
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw new Exception('Cần lý do từ chối', 400);
        }
        $app = $this->repo->findById($applicationId);
        if (!$app) {
            throw new Exception('Không tìm thấy đơn đăng ký', 404);
        }
        if ($app['status'] !== 'pending') {
            throw new Exception('Chỉ có thể từ chối đơn đang chờ', 400);
        }
        $this->repo->reject($applicationId, $reviewerId, $reason);
        return $this->repo->findById($applicationId);
    }

    public function requireSeller(int $userId): void
    {
        if (!$this->repo->userIsSeller($userId)) {
            throw new Exception('Bạn cần đăng ký bán hàng và được duyệt trước khi đăng sản phẩm', 403);
        }
    }

    public function isSeller(int $userId): bool
    {
        return $this->repo->userIsSeller($userId);
    }
}
