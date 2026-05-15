<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class CaroMoveType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'CaroMove',
            'fields' => fn() => [
                'r' => Type::nonNull(Type::int()),
                'c' => Type::nonNull(Type::int()),
                's' => Type::nonNull(Type::string()),
            ],
        ]);
    }
}
