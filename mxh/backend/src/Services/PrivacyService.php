<?php

namespace App\Services;

use App\Repositories\UserRepository;
use App\Repositories\FriendshipRepository;

/**
 * Nguồn sự thật duy nhất cho quyền xem nội dung theo chế độ private/public.
 *
 * Quy tắc canView(viewer, owner) = true khi:
 *   1. owner đang public (is_private = 0), HOẶC
 *   2. viewer chính là owner, HOẶC
 *   3. viewer và owner là bạn bè (friendships.status = 'accepted').
 * Mọi trường hợp khác (kể cả người theo dõi không phải bạn) → false.
 */
class PrivacyService
{
    private UserRepository $userRepo;
    private FriendshipRepository $friendRepo;

    public function __construct()
    {
        $this->userRepo = new UserRepository();
        $this->friendRepo = new FriendshipRepository();
    }

    /**
     * @param int|null $viewerId  id người xem (null = chưa đăng nhập)
     * @param int      $ownerId   id chủ nội dung
     */
    public function canView(?int $viewerId, int $ownerId): bool
    {
        $owner = $this->userRepo->findById($ownerId);
        if (!$owner || empty($owner['is_private'])) {
            return true; // không tồn tại hoặc public → cho xem (post resolver sẽ tự xử lý 404 nếu cần)
        }

        if ($viewerId !== null && $viewerId === $ownerId) {
            return true; // chính chủ
        }

        if ($viewerId === null) {
            return false; // private + ẩn danh
        }

        return $this->friendRepo->getFriendshipStatus($viewerId, $ownerId) === 'accepted';
    }

    /** Kiểm tra owner có đang ở chế độ private không. */
    public function isPrivate(int $ownerId): bool
    {
        $owner = $this->userRepo->findById($ownerId);
        return !empty($owner['is_private']);
    }

    /**
     * Danh sách id bạn bè của viewer — dùng dựng bộ lọc cho feed nhiều tác giả.
     * @return int[]
     */
    public function friendIds(int $viewerId): array
    {
        return array_map('intval', $this->friendRepo->getFriendIds($viewerId));
    }
}
