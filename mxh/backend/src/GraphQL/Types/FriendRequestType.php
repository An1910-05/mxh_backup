<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class FriendRequestType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'FriendRequest',
            'fields' => fn() => [
                'friendship_id' => Type::nonNull(Type::int()),
                'id' => Type::nonNull(Type::int()),
                'username' => Type::nonNull(Type::string()),
                'custom_url' => Type::string(),
                'avatar' => Type::string(),
                'request_date' => Type::string(),
            ],
        ]);
    }
}
