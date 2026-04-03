<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class FriendshipType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Friendship',
            'fields' => fn() => [
                'friendship_id' => Type::int(),
                'status' => Type::string(),
                'is_sender' => Type::boolean(),
            ],
        ]);
    }
}
