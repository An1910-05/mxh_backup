<?php

namespace App\Helpers;

use App\Repositories\UserRepository;

class MentionHelper
{
    /**
     * @return int[] danh sách user id được tag
     */
    public static function resolveUserIdsFromText(string $text): array
    {
        $text = trim($text);
        if ($text === '') {
            return [];
        }

        if (!preg_match_all('/@([a-zA-Z0-9._]{1,50})/u', $text, $m)) {
            return [];
        }

        $repo = new UserRepository();
        $ids = [];
        foreach (array_unique($m[1]) as $raw) {
            $u = $repo->findByUsername($raw);
            if ($u && isset($u['id'])) {
                $ids[(int) $u['id']] = true;
            }
        }

        return array_map('intval', array_keys($ids));
    }
}
