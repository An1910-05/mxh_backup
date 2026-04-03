<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class SearchUserType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'SearchUser',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'username' => Type::nonNull(Type::string()),
                'email' => Type::string(),
                'custom_url' => Type::string(),
                'avatar' => Type::string(),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
