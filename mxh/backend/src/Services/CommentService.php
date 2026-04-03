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

    public function createComment(int $postId, int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null): array
    {
        $post = $this->postRepo->findById($postId);
        if (!$post) throw new \RuntimeException('Post not found', 404);

        $commentId = $this->commentRepo->create($postId, $userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight);
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
}
