<?php

namespace App\GraphQL\Types;

use App\GraphQL\TypeRegistry;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuPlaceBetResultType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuPlaceBetResult',
            'fields' => fn() => [
                'balance'       => Type::nonNull(Type::int()),
                'current_round' => TypeRegistry::taiXiuCurrentRound(),
            ],
        ]);
    }
}
