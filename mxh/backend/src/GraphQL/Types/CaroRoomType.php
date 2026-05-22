<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use App\GraphQL\TypeRegistry;

class CaroRoomType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'CaroRoom',
            'fields' => fn() => [
                'id'             => Type::nonNull(Type::int()),
                'code'           => Type::nonNull(Type::string()),
                'name'           => Type::string(),
                'has_password'   => Type::nonNull(Type::boolean()),
                'visibility'     => Type::nonNull(Type::string()),    // 'private' | 'public'
                'is_matchmaking' => Type::nonNull(Type::boolean()),
                'status'         => Type::nonNull(Type::string()),    // 'waiting' | 'playing' | 'finished' | 'abandoned'
                'current_turn'   => Type::nonNull(Type::string()),    // 'X' | 'O'
                'board_size'     => Type::nonNull(Type::int()),
                'win_length'     => Type::nonNull(Type::int()),
                'move_count'     => Type::nonNull(Type::int()),
                'moves'          => Type::listOf(Type::nonNull(TypeRegistry::caroMove())),
                'winner_symbol'  => Type::string(),                   // 'X' | 'O' | 'draw' | null
                'winner_user_id' => Type::int(),
                'creator'        => TypeRegistry::caroPlayer(),
                'opponent'       => TypeRegistry::caroPlayer(),
                'viewer_symbol'           => Type::string(),           // 'X' | 'O' | null
                'is_my_turn'              => Type::nonNull(Type::boolean()),
                'rematch_room_id'         => Type::int(),
                'rematch_room_code'       => Type::string(),
                'rematch_initiated_by_id' => Type::int(),
                'created_at'     => Type::string(),
                'updated_at'     => Type::string(),
                'last_move_at'   => Type::string(),
            ],
        ]);
    }
}
