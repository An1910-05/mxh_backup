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
                'role' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['role'] ?? 'user',
                ],
                'is_seller' => [
                    'type' => Type::boolean(),
                    'resolve' => fn($row) => !empty($row['is_seller']),
                ],
                'created_at' => Type::string(),
                'updated_at' => Type::string(),
            ],
        ]);
    }
}
