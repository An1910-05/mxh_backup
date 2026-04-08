<?php

namespace App\Services;

use App\Helpers\MentionHelper;
use App\Repositories\CommentRepository;
use App\Repositories\MentionRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\PostRepository;

class CommentService
{
    private CommentRepository $commentRepo;
    private PostRepository $postRepo;

    public function __construct()
    {
        $this->commentRepo = new CommentRepository();
        $this->postRepo = new PostRepository();
    }

    public function createComment(int $postId, int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?int $parentId = null): array
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);

        // Validate parent + flatten 2-level: if parent has its own parent, use that as the real parent
        $parentComment = null;
        if ($parentId !== null) {
            $parentComment = $this->commentRepo->findById($parentId);
            if (!$parentComment || (int)$parentComment['post_id'] !== $postId) {
                throw new \RuntimeException('Invalid parent comment', 400);
            }
            if (!empty($parentComment['parent_id'])) {
                $parentId = (int)$parentComment['parent_id'];
                $parentComment = $this->commentRepo->findById($parentId);
            }
        }

        $commentId = $this->commentRepo->create($postId, $userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $parentId);
        $comment = $this->commentRepo->findById($commentId);
        if (!$comment) throw new \RuntimeException('Comment create failed', 500);

        $mentionIds = MentionHelper::resolveUserIdsFromText($content);
        (new MentionRepository())->syncCommentMentions($commentId, $mentionIds);

        $postOwnerId = (int)$post['user_id'];
        $notifRepo = new NotificationRepository();
        $notifiedOwner = false;
        if ($postOwnerId !== $userId) {
            $notifRepo->insert($postOwnerId, 'comment', $userId, $postId, $commentId);
            $notifiedOwner = true;
        }

        // Notify parent comment author (reply notification)
        if ($parentComment) {
            $parentAuthorId = (int)$parentComment['user_id'];
            if ($parentAuthorId !== $userId && $parentAuthorId !== $postOwnerId) {
                $notifRepo->insert($parentAuthorId, 'reply', $userId, $postId, $commentId);
            }
        }

        foreach ($mentionIds as $uid) {
            if ((int)$uid === $userId) continue;
            if ((int)$uid === $postOwnerId && $notifiedOwner) continue;
            $notifRepo->insert((int)$uid, 'mention_comment', $userId, $postId, $commentId);
        }

        return $comment;
    }

    public function getCommentsByPost(int $postId): array
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);
        return $this->commentRepo->findByPostId($postId);
    }

    public function deleteComment(int $commentId, int $userId): bool
    {
        $comment = $this->commentRepo->findById($commentId);
        if (!$comment) throw new \RuntimeException('Comment not found', 404);

        $post = $this->postRepo->findById((int)$comment['post_id']);
        if (!$post) throw new \RuntimeException('Post not found', 404);

        $isCommentAuthor = (int)$comment['user_id'] === $userId;
        $isPostOwner = (int)$post['user_id'] === $userId;
        if (!$isCommentAuthor && !$isPostOwner) {
            throw new \RuntimeException('Forbidden', 403);
        }

        return $this->commentRepo->delete($commentId);
    }
}
