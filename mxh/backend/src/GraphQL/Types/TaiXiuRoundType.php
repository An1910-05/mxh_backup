<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuRoundType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuRound',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'round_code' => Type::nonNull(Type::string()),
                'md5_hash' => Type::nonNull(Type::string()),
                'dice' => Type::nonNull(Type::listOf(Type::nonNull(Type::int()))),
                'total' => Type::nonNull(Type::int()),
                'result_key' => Type::nonNull(Type::string()),
                'result_label' => Type::nonNull(Type::string()),
                'jackpot_side' => Type::string(),
                'jackpot_payout' => Type::nonNull(Type::int()),
                'tai_pool_snapshot' => Type::nonNull(Type::int()),
                'xiu_pool_snapshot' => Type::nonNull(Type::int()),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
