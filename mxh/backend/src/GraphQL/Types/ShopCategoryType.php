<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;

class ShopCategoryType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopCategory',
            'fields' => [
                'id' => Type::nonNull(Type::int()),
                'name' => Type::nonNull(Type::string()),
                'slug' => Type::nonNull(Type::string()),
                'description' => Type::string(),
                'icon' => Type::string(),
                'displayOrder' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['display_order']
                ],
                'isActive' => [
                    'type' => Type::nonNull(Type::boolean()),
                    'resolve' => fn($root) => (bool) $root['is_active']
                ],
                'productCount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) ($root['product_count'] ?? 0)
                ],
                'createdAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['created_at']
                ]
            ]
        ]);
    }
}
