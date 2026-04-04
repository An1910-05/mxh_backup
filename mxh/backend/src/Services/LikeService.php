<?php

namespace App\Services;

use App\Repositories\LikeRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\PostRepository;

class LikeService
{
    private LikeRepository $likeRepo;
    private PostRepository $postRepo;
    private NotificationRepository $notifRepo;

    public function __construct()
    {
        $this->likeRepo = new LikeRepository();
        $this->postRepo = new PostRepository();
        $this->notifRepo = new NotificationRepository();
    }

    public function likePost(int $postId, int $userId, string $reactionType = 'like'): bool
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) {
            throw new \RuntimeException('Post not found', 404);
        }

        $isNew = !$this->likeRepo->isLikedByUser($postId, $userId);
        $this->likeRepo->createOrUpdate($postId, $userId, $reactionType);

        if ($isNew) {
            $postOwnerId = (int)$post['user_id'];
            if ($postOwnerId !== $userId) {
                $this->notifRepo->insert($postOwnerId, 'like', $userId, $postId, null);
            }
        }

        return true;
    }

    public function unlikePost(int $postId, int $userId): bool
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) {
            throw new \RuntimeException('Post not found', 404);
        }

        if (!$this->likeRepo->isLikedByUser($postId, $userId)) {
            throw new \RuntimeException('You have not liked this post', 409);
        }

        return $this->likeRepo->delete($postId, $userId);
    }

    public function getPostLikers(int $postId, int $limit = 50): array
    {
        return $this->likeRepo->getLikersByPostId($postId, $limit);
    }
}
