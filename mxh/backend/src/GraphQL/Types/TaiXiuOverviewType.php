<?php

namespace App\GraphQL\Types;

use App\GraphQL\TypeRegistry;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuOverviewType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuOverview',
            'fields' => fn() => [
                'balance'           => Type::nonNull(Type::int()),
                'jackpot_tai_pool'  => Type::nonNull(Type::int()),
                'jackpot_xiu_pool'  => Type::nonNull(Type::int()),
                'tai_result_rate'   => Type::nonNull(Type::int()),
                'xiu_result_rate'   => Type::nonNull(Type::int()),
                'recent_rounds'     => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuRound()))),
                'my_recent_bets'    => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuBet()))),
                'jackpot_history'   => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuRound()))),
                'current_round'     => TypeRegistry::taiXiuCurrentRound(),
            ],
        ]);
    }
}
