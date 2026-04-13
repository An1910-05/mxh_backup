<?php

namespace App\Services;

use App\Helpers\MentionHelper;
use App\Repositories\PostRepository;
use App\Repositories\LikeRepository;
use App\Repositories\CommentRepository;
use App\Repositories\FollowRepository;
use App\Repositories\MentionRepository;
use App\Repositories\NotificationRepository;

class PostService
{
    private PostRepository $postRepo;
    private LikeRepository $likeRepo;
    private CommentRepository $commentRepo;
    private FollowRepository $followRepo;

    public function __construct()
    {
        $this->postRepo = new PostRepository();
        $this->likeRepo = new LikeRepository();
        $this->commentRepo = new CommentRepository();
        $this->followRepo = new FollowRepository();
    }

    public function createPost(int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?string $locationLabel = null, ?float $latitude = null, ?float $longitude = null): array
    {
        $postId = $this->postRepo->create($userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $locationLabel, $latitude, $longitude);

        $mentionIds = MentionHelper::resolveUserIdsFromText($content);
        (new MentionRepository())->syncPostMentions($postId, $mentionIds);

        $notifRepo = new NotificationRepository();
        foreach ($mentionIds as $uid) {
            if ((int)$uid === $userId) continue;
            $notifRepo->insert((int)$uid, 'mention_post', $userId, $postId, null);
        }

        return $this->getPost($postId, $userId);
    }

    public function getPost(int $postId, ?int $currentUserId = null): array
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);
        return $this->enrichPost($post, $currentUserId);
    }

    public function getPosts(int $limit = 20, int $page = 1, ?int $currentUserId = null): array
    {
        $offset = ($page - 1) * $limit;
        $posts = $this->postRepo->findAll($limit, $offset);
        return $this->enrichPosts($posts, $currentUserId);
    }

    public function getUserPosts(int $userId, int $limit = 20, int $page = 1, ?int $currentUserId = null): array
    {
        $offset = ($page - 1) * $limit;
        $posts = $this->postRepo->findByUserId($userId, $limit, $offset);
        return $this->enrichPosts($posts, $currentUserId);
    }

    public function getFeed(int $userId, int $limit = 20, int $page = 1): array
    {
        $followingIds = $this->followRepo->getFollowingIds($userId);
        $feedUserIds = array_merge([$userId], $followingIds);
        $offset = ($page - 1) * $limit;
        $posts = $this->postRepo->findByUserIds($feedUserIds, $limit, $offset);
        return $this->enrichPosts($posts, $userId);
    }

    public function editPost(int $postId, int $userId, string $content): array
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);
        if ((int)$post['user_id'] !== $userId) throw new \RuntimeException('Forbidden', 403);
        $this->postRepo->update($postId, $content);
        return $this->getPost($postId, $userId);
    }

    public function deletePost(int $postId, int $userId): bool
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);
        if ((int)$post['user_id'] !== $userId) throw new \RuntimeException('Forbidden', 403);
        return $this->postRepo->delete($postId);
    }

    /**
     * Batch enrich: 3 queries cho toàn bộ danh sách thay vì 3*N queries.
     */
    private function enrichPosts(array $posts, ?int $currentUserId = null): array
    {
        if (empty($posts)) return [];
        $postIds = array_column($posts, 'id');

        $likeCounts    = $this->likeRepo->countByPostIds($postIds);
        $commentCounts = $this->commentRepo->countByPostIds($postIds);
        $likedSet      = $currentUserId ? $this->likeRepo->likedPostsByUser($postIds, $currentUserId) : [];
        $topReactions  = $this->likeRepo->topReactionsByPostIds($postIds, 2);

        return array_map(function ($post) use ($likeCounts, $commentCounts, $likedSet, $topReactions, $currentUserId) {
            $id = $post['id'];
            $post['like_count']    = $likeCounts[$id]    ?? 0;
            $post['comment_count'] = $commentCounts[$id] ?? 0;
            $post['is_liked']      = $currentUserId ? ($likedSet[$id] ?? false) : null;
            $post['top_reactions'] = $topReactions[$id]  ?? [];
            return $post;
        }, $posts);
    }

    private function enrichPost(array $post, ?int $currentUserId = null): array
    {
        $post['like_count']    = $this->likeRepo->countByPostId($post['id']);
        $post['comment_count'] = $this->commentRepo->countByPostId($post['id']);
        $post['is_liked']      = $currentUserId ? $this->likeRepo->isLikedByUser($post['id'], $currentUserId) : null;
        $topReactions          = $this->likeRepo->topReactionsByPostIds([$post['id']], 2);
        $post['top_reactions'] = $topReactions[$post['id']] ?? [];
        return $post;
    }
}
