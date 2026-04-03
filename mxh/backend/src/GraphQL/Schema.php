<?php

namespace App\GraphQL;

use GraphQL\Type\Schema as BaseSchema;
use App\GraphQL\Queries\QueryType;
use App\GraphQL\Mutations\MutationType;

class Schema
{
    private static ?BaseSchema $schema = null;

    public static function build(): BaseSchema
    {
        if (self::$schema === null) {
            self::$schema = new BaseSchema([
                'query' => new QueryType(),
                'mutation' => new MutationType(),
            ]);
        }

        return self::$schema;
    }
}
