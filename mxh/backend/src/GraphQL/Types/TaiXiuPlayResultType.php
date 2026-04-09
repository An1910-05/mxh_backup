<?php

namespace App\GraphQL\Types;

use App\GraphQL\TypeRegistry;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuPlayResultType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuPlayResult',
            'fields' => fn() => [
                'balance' => Type::nonNull(Type::int()),
                'jackpot_tai_pool' => Type::nonNull(Type::int()),
                'jackpot_xiu_pool' => Type::nonNull(Type::int()),
                'next_round_code' => Type::nonNull(Type::string()),
                'bet' => Type::nonNull(TypeRegistry::taiXiuBet()),
                'round' => Type::nonNull(TypeRegistry::taiXiuRound()),
            ],
        ]);
    }
}
