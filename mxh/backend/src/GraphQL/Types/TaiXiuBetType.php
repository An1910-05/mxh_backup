<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuBetType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuBet',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'round_id' => Type::nonNull(Type::int()),
                'round_code' => Type::nonNull(Type::string()),
                'md5_hash' => Type::nonNull(Type::string()),
                'bet_side' => Type::nonNull(Type::string()),
                'bet_label' => Type::nonNull(Type::string()),
                'bet_amount' => Type::nonNull(Type::int()),
                'result_key' => Type::nonNull(Type::string()),
                'result_label' => Type::nonNull(Type::string()),
                'dice' => Type::nonNull(Type::listOf(Type::nonNull(Type::int()))),
                'total' => Type::nonNull(Type::int()),
                'did_win' => Type::nonNull(Type::boolean()),
                'net_amount' => Type::nonNull(Type::int()),
                'balance_after' => Type::nonNull(Type::int()),
                'jackpot_hit' => Type::nonNull(Type::boolean()),
                'jackpot_payout' => Type::nonNull(Type::int()),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
