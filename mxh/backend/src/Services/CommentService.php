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

        // Validate parent comment belongs to same post
        if ($parentId !== null) {
            $parent = $this->commentRepo->findById($parentId);
            if (!$parent || (int)$parent['post_id'] !== $postId) {
                throw new \RuntimeException('Parent comment not found', 404);
            }
            // Flatten to 2-level max: if parent is already a reply, attach to its parent
            if (!empty($parent['parent_id'])) {
                $parentId = (int)$parent['parent_id'];
            }
        }

        $commentId = $this->commentRepo->create($postId, $userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $parentId);
        $comment = $this->commentRepo->findById($commentId);
        if (!$comment) throw new \RuntimeException('Comment create failed', 500);

        $mentionIds = MentionHelper::resolveUserIdsFromText($content);
        (new MentionRepository())->syncCommentMentions($commentId, $mentionIds);

        $postOwnerId = (int)$post['user_id'];
        $notifRepo = new NotificationRepository();
        $notifiedSet = [];

        // Notify post owner
        if ($postOwnerId !== $userId) {
            $notifRepo->insert($postOwnerId, 'comment', $userId, $postId, $commentId);
            $notifiedSet[$postOwnerId] = true;
        }

        // Notify parent comment author (reply)
        if ($parentId !== null) {
            $parentComment = $this->commentRepo->findById($parentId);
            if ($parentComment) {
                $parentAuthorId = (int)$parentComment['user_id'];
                if ($parentAuthorId !== $userId && !isset($notifiedSet[$parentAuthorId])) {
                    $notifRepo->insert($parentAuthorId, 'reply', $userId, $postId, $commentId);
                    $notifiedSet[$parentAuthorId] = true;
                }
            }
        }

        // Notify mentioned users
        foreach ($mentionIds as $uid) {
            if ((int)$uid === $userId) continue;
            if (isset($notifiedSet[(int)$uid])) continue;
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
}
