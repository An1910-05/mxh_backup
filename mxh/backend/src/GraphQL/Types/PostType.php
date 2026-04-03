<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use App\GraphQL\TypeRegistry;

class PostType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Post',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'user_id' => Type::nonNull(Type::int()),
                'username' => Type::string(),
                'user_avatar' => Type::string(),
                'content' => Type::nonNull(Type::string()),
                'media_url' => Type::string(),
                'media_type' => Type::string(),
                'media_width' => Type::int(),
                'media_height' => Type::int(),
                'location_label' => Type::string(),
                'latitude' => Type::float(),
                'longitude' => Type::float(),
                'like_count' => Type::int(),
                'comment_count' => Type::int(),
                'is_liked' => Type::boolean(),
                'created_at' => Type::string(),
                'updated_at' => Type::string(),
            ],
        ]);
    }
}
