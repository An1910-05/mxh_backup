<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class MentionRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function syncPostMentions(int $postId, array $mentionedUserIds): void
    {
        $stmt = $this->db->prepare('DELETE FROM post_mentions WHERE post_id = ?');
        $stmt->execute([$postId]);
        $mentionedUserIds = array_unique(array_map('intval', $mentionedUserIds));
        foreach ($mentionedUserIds as $uid) {
            if ($uid <= 0) continue;
            $ins = $this->db->prepare('INSERT IGNORE INTO post_mentions (post_id, mentioned_user_id) VALUES (?, ?)');
            $ins->execute([$postId, $uid]);
        }
    }

    public function syncCommentMentions(int $commentId, array $mentionedUserIds): void
    {
        $stmt = $this->db->prepare('DELETE FROM comment_mentions WHERE comment_id = ?');
        $stmt->execute([$commentId]);
        $mentionedUserIds = array_unique(array_map('intval', $mentionedUserIds));
        foreach ($mentionedUserIds as $uid) {
            if ($uid <= 0) continue;
            $ins = $this->db->prepare('INSERT IGNORE INTO comment_mentions (comment_id, mentioned_user_id) VALUES (?, ?)');
            $ins->execute([$commentId, $uid]);
        }
    }
}
