<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class CaroPlayerType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'CaroPlayer',
            'fields' => fn() => [
                'id'         => Type::nonNull(Type::int()),
                'username'   => Type::nonNull(Type::string()),
                'custom_url' => Type::string(),
                'avatar'     => Type::string(),
            ],
        ]);
    }
}
