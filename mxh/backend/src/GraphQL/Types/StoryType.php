<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class StoryType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Story',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'user_id' => Type::nonNull(Type::int()),
                'username' => Type::string(),
                'user_avatar' => Type::string(),
                'media_url' => Type::nonNull(Type::string()),
                'media_type' => Type::nonNull(Type::string()),
                'media_width' => Type::int(),
                'media_height' => Type::int(),
                'created_at' => Type::string(),
                'expires_at' => Type::string(),
            ],
        ]);
    }
}
