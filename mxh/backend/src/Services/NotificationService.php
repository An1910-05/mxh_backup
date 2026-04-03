<?php

namespace App\Services;

use App\Repositories\NotificationRepository;

class NotificationService
{
    public function listForUser(int $userId, int $limit = 40, int $page = 1): array
    {
        $offset = ($page - 1) * $limit;
        return (new NotificationRepository())->findByUserId($userId, $limit, $offset);
    }

    public function unreadCount(int $userId): int
    {
        return (new NotificationRepository())->countUnread($userId);
    }

    public function markRead(int $notificationId, int $userId): bool
    {
        return (new NotificationRepository())->markRead($notificationId, $userId);
    }

    public function markAllRead(int $userId): int
    {
        return (new NotificationRepository())->markAllRead($userId);
    }

    public function delete(int $notificationId, int $userId): bool
    {
        return (new NotificationRepository())->delete($notificationId, $userId);
    }

    public function deleteAll(int $userId): int
    {
        return (new NotificationRepository())->deleteAll($userId);
    }
}
