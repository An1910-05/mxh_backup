<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;

class ShopReviewStatsType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopReviewStats',
            'fields' => [
                'total'      => Type::nonNull(Type::int()),
                'avgRating'  => Type::nonNull(Type::float()),
                'star5'      => Type::nonNull(Type::int()),
                'star4'      => Type::nonNull(Type::int()),
                'star3'      => Type::nonNull(Type::int()),
                'star2'      => Type::nonNull(Type::int()),
                'star1'      => Type::nonNull(Type::int()),
                'withImages' => Type::nonNull(Type::int()),
            ],
        ]);
    }
}
