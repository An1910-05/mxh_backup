<?php

namespace App\Services;

use App\Repositories\ShopReviewRepository;
use App\Repositories\ShopOrderRepository;
use Exception;

class ShopReviewService
{
    private ShopReviewRepository $reviewRepo;
    private ShopOrderRepository  $orderRepo;

    public function __construct()
    {
        $this->reviewRepo = new ShopReviewRepository();
        $this->orderRepo  = new ShopOrderRepository();
    }

    public function getProductReviews(int $productId, ?int $rating = null, int $limit = 20, int $page = 1): array
    {
        $offset = max(0, ($page - 1) * $limit);
        $rows = $this->reviewRepo->findByProduct($productId, $rating, $limit, $offset);
        return array_map([$this, 'decode'], $rows);
    }

    public function getSellerReviews(int $sellerId, int $limit = 20, int $page = 1): array
    {
        $offset = max(0, ($page - 1) * $limit);
        $rows = $this->reviewRepo->findBySeller($sellerId, $limit, $offset);
        return array_map([$this, 'decode'], $rows);
    }

    public function getStatsForProduct(int $productId): array
    {
        return $this->reviewRepo->statsForProduct($productId);
    }

    public function getStatsForSeller(int $sellerId): array
    {
        return $this->reviewRepo->statsForSeller($sellerId);
    }

    public function getMyReviewForOrder(int $orderId, int $buyerId): ?array
    {
        $review = $this->reviewRepo->findByOrderId($orderId);
        if (!$review) return null;
        if ((int)$review['buyer_id'] !== $buyerId) return null;
        return $this->decode($review);
    }

    public function createReview(int $buyerId, array $data): array
    {
        $orderId = (int)($data['order_id'] ?? 0);
        if ($orderId <= 0) throw new Exception('Order ID is required', 400);

        $order = $this->orderRepo->findById($orderId);
        if (!$order) throw new Exception('Order not found', 404);

        if ((int)$order['buyer_id'] !== $buyerId) {
            throw new Exception('You can only review your own orders', 403);
        }

        if ($order['status'] !== 'completed') {
            throw new Exception('Chỉ có thể đánh giá sau khi đơn hàng đã hoàn tất', 400);
        }

        if ($this->reviewRepo->findByOrderId($orderId)) {
            throw new Exception('Đơn hàng này đã được đánh giá', 400);
        }

        $rating = (int)($data['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) throw new Exception('Rating must be from 1 to 5', 400);

        $content = trim((string)($data['content'] ?? ''));
        if ($content === '') throw new Exception('Nội dung đánh giá không được để trống', 400);
        if (mb_strlen($content) > 2000) throw new Exception('Nội dung đánh giá tối đa 2000 ký tự', 400);

        $images = $data['images'] ?? null;
        if ($images !== null) {
            if (!is_array($images)) throw new Exception('Images must be an array', 400);
            if (count($images) > 5)  throw new Exception('Tối đa 5 ảnh đánh giá', 400);
        }

        $reviewId = $this->reviewRepo->create([
            'order_id'   => $orderId,
            'product_id' => (int)$order['product_id'],
            'buyer_id'   => $buyerId,
            'seller_id'  => (int)$order['seller_id'],
            'rating'     => $rating,
            'content'    => $content,
            'images'     => $images,
        ]);

        return $this->decode($this->reviewRepo->findById($reviewId));
    }

    public function updateReview(int $reviewId, int $buyerId, array $data): array
    {
        $review = $this->reviewRepo->findById($reviewId);
        if (!$review) throw new Exception('Review not found', 404);
        if ((int)$review['buyer_id'] !== $buyerId) {
            throw new Exception('You can only edit your own review', 403);
        }

        // Chỉ cho sửa trong 7 ngày
        $createdTs = strtotime($review['created_at']);
        if ($createdTs && (time() - $createdTs) > 7 * 86400) {
            throw new Exception('Chỉ có thể chỉnh sửa đánh giá trong vòng 7 ngày', 400);
        }

        $update = [];
        if (isset($data['rating'])) {
            $r = (int)$data['rating'];
            if ($r < 1 || $r > 5) throw new Exception('Rating must be from 1 to 5', 400);
            $update['rating'] = $r;
        }
        if (isset($data['content'])) {
            $c = trim((string)$data['content']);
            if ($c === '') throw new Exception('Nội dung đánh giá không được để trống', 400);
            if (mb_strlen($c) > 2000) throw new Exception('Nội dung đánh giá tối đa 2000 ký tự', 400);
            $update['content'] = $c;
        }
        if (array_key_exists('images', $data)) {
            $imgs = $data['images'];
            if ($imgs !== null) {
                if (!is_array($imgs)) throw new Exception('Images must be an array', 400);
                if (count($imgs) > 5)  throw new Exception('Tối đa 5 ảnh đánh giá', 400);
            }
            $update['images'] = $imgs;
        }

        $this->reviewRepo->update($reviewId, $update);
        return $this->decode($this->reviewRepo->findById($reviewId));
    }

    public function replyToReview(int $reviewId, int $sellerId, string $reply): array
    {
        $review = $this->reviewRepo->findById($reviewId);
        if (!$review) throw new Exception('Review not found', 404);
        if ((int)$review['seller_id'] !== $sellerId) {
            throw new Exception('Only the seller can reply to this review', 403);
        }
        $reply = trim($reply);
        if ($reply === '') throw new Exception('Phản hồi không được để trống', 400);
        if (mb_strlen($reply) > 1000) throw new Exception('Phản hồi tối đa 1000 ký tự', 400);

        $this->reviewRepo->reply($reviewId, $reply);
        return $this->decode($this->reviewRepo->findById($reviewId));
    }

    public function deleteReview(int $reviewId, int $userId, bool $isAdmin = false): bool
    {
        $review = $this->reviewRepo->findById($reviewId);
        if (!$review) throw new Exception('Review not found', 404);
        if (!$isAdmin && (int)$review['buyer_id'] !== $userId) {
            throw new Exception('You can only delete your own review', 403);
        }
        return $this->reviewRepo->delete($reviewId);
    }

    private function decode(array $row): array
    {
        if (isset($row['images']) && is_string($row['images'])) {
            $row['images'] = json_decode($row['images'], true) ?: [];
        }
        if (!isset($row['images']) || $row['images'] === null) {
            $row['images'] = [];
        }
        return $row;
    }
}
