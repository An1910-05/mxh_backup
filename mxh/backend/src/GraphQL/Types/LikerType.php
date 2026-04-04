<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class LikerType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Liker',
            'fields' => [
                'id'            => Type::nonNull(Type::int()),
                'username'      => Type::string(),
                'user_avatar'   => Type::string(),
                'reaction_type' => Type::string(),
            ],
        ]);
    }
}
