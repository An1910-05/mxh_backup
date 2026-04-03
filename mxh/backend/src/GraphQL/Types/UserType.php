<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class UserType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'User',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'username' => Type::nonNull(Type::string()),
                'email' => Type::nonNull(Type::string()),
                'custom_url' => Type::string(),
                'created_at' => Type::string(),
                'updated_at' => Type::string(),
            ],
        ]);
    }
}
