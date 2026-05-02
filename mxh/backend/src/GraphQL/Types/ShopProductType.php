<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use App\GraphQL\TypeRegistry;

class ShopProductType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopProduct',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'sellerId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['seller_id']
                ],
                'seller' => [
                    'type' => TypeRegistry::user(),
                    'resolve' => fn($root) => [
                        'id' => $root['seller_id'],
                        'username' => $root['seller_username'],
                        'avatar' => $root['seller_avatar']
                    ]
                ],
                'categoryId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['category_id']
                ],
                'category' => [
                    'type' => TypeRegistry::shopCategory(),
                    'resolve' => fn($root) => [
                        'id' => $root['category_id'],
                        'name' => $root['category_name'],
                        'slug' => $root['category_slug']
                    ]
                ],
                'title' => Type::nonNull(Type::string()),
                'description' => Type::nonNull(Type::string()),
                'productType' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['product_type']
                ],
                'price' => Type::nonNull(Type::int()),
                'stockQuantity' => [
                    'type' => Type::int(),
                    'resolve' => fn($root) => $root['stock_quantity']
                ],
                'images' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(Type::string()))),
                    'resolve' => fn($root) => $root['images'] ?? []
                ],
                'digitalFileUrl' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['digital_file_url']
                ],
                'status' => Type::nonNull(Type::string()),
                'rejectionReason' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['rejection_reason']
                ],
                'viewCount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['view_count']
                ],
                'soldCount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['sold_count']
                ],
                'createdAt' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['created_at']
                ],
                'updatedAt' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['updated_at']
                ],
                'approvedAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['approved_at']
                ],
                'approvedBy' => [
                    'type' => Type::int(),
                    'resolve' => fn($root) => $root['approved_by']
                ]
            ]
        ]);
    }
}
