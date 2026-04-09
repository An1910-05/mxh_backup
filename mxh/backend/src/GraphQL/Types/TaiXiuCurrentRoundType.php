<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class TaiXiuCurrentRoundType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'TaiXiuCurrentRound',
            'fields' => fn() => [
                'id'               => Type::nonNull(Type::int()),
                'round_code'       => Type::nonNull(Type::string()),
                'status'           => Type::nonNull(Type::string()),   // 'betting' | 'finished'
                'seconds_left'     => Type::nonNull(Type::int()),
                'betting_deadline' => Type::string(),
                'tai_total'        => Type::nonNull(Type::int()),
                'tai_count'        => Type::nonNull(Type::int()),
                'xiu_total'        => Type::nonNull(Type::int()),
                'xiu_count'        => Type::nonNull(Type::int()),
                'dice'             => Type::listOf(Type::nonNull(Type::int())),
                'total'            => Type::nonNull(Type::int()),
                'result_key'       => Type::string(),
                'result_label'     => Type::string(),
                'my_bet_side'      => Type::string(),
                'my_bet_amount'    => Type::nonNull(Type::int()),
                'my_did_win'       => Type::boolean(),
                'jackpot_payout'   => Type::nonNull(Type::int()),
            ],
        ]);
    }
}
