<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class CommentType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Comment',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'post_id' => Type::nonNull(Type::int()),
                'user_id' => Type::nonNull(Type::int()),
                'parent_id' => Type::int(),
                'username' => Type::string(),
                'user_avatar' => Type::string(),
                'content' => Type::nonNull(Type::string()),
                'media_url' => Type::string(),
                'media_type' => Type::string(),
                'media_width' => Type::int(),
                'media_height' => Type::int(),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
