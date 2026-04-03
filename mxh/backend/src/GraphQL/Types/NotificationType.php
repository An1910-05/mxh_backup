<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class NotificationType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Notification',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'type' => Type::nonNull(Type::string()),
                'actor_id' => Type::nonNull(Type::int()),
                'actor_username' => Type::string(),
                'actor_avatar' => Type::string(),
                'post_id' => Type::int(),
                'comment_id' => Type::int(),
                'read_at' => Type::string(),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
