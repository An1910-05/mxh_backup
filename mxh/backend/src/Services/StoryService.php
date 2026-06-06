<?php

namespace App\Services;

use App\Repositories\StoryRepository;
use App\Repositories\FollowRepository;

class StoryService
{
    private StoryRepository $storyRepo;
    private FollowRepository $followRepo;
    private PrivacyService $privacy;

    public function __construct()
    {
        $this->storyRepo = new StoryRepository();
        $this->followRepo = new FollowRepository();
        $this->privacy = new PrivacyService();
    }

    public function createStory(int $userId, string $mediaUrl, string $mediaType, ?int $mediaWidth = null, ?int $mediaHeight = null): array
    {
        $storyId = $this->storyRepo->create($userId, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight);
        return $this->storyRepo->findById($storyId);
    }

    public function getStory(int $storyId): ?array
    {
        return $this->storyRepo->findById($storyId);
    }

    public function getUserStories(int $userId, ?int $currentUserId = null): array
    {
        // Story của tài khoản private chỉ hiển thị cho bạn bè / chính chủ.
        if (!$this->privacy->canView($currentUserId, $userId)) {
            return [];
        }
        return $this->storyRepo->findActiveByUserId($userId);
    }

    /**
     * Returns stories grouped by user for the feed.
     * Each group: { user_id, username, user_avatar, stories: [...] }
     */
    public function getFeedStories(int $currentUserId): array
    {
        $followingIds = $this->followRepo->getFollowingIds($currentUserId);
        $feedUserIds = array_merge([$currentUserId], $followingIds);

        // Loại story của người mình theo dõi nhưng để private và chưa kết bạn.
        $friendIds = $this->privacy->friendIds($currentUserId);
        $allStories = $this->storyRepo->findFeedStories($feedUserIds, $currentUserId, $friendIds);

        $grouped = [];
        foreach ($allStories as $story) {
            $uid = (int) $story['user_id'];
            if (!isset($grouped[$uid])) {
                $grouped[$uid] = [
                    'user_id' => $uid,
                    'username' => $story['username'],
                    'user_avatar' => $story['user_avatar'],
                    'stories' => [],
                ];
            }
            $grouped[$uid]['stories'][] = $story;
        }

        $result = array_values($grouped);

        // Put current user's stories first
        usort($result, function ($a, $b) use ($currentUserId) {
            if ($a['user_id'] === $currentUserId) return -1;
            if ($b['user_id'] === $currentUserId) return 1;
            return 0;
        });

        return $result;
    }

    public function deleteStory(int $storyId, int $userId): bool
    {
        $story = $this->storyRepo->findById($storyId);
        if (!$story) {
            throw new \RuntimeException('Story not found', 404);
        }
        if ((int) $story['user_id'] !== $userId) {
            throw new \RuntimeException('Forbidden', 403);
        }
        return $this->storyRepo->delete($storyId);
    }
}
