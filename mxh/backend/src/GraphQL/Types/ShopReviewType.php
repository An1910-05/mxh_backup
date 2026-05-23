<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use App\GraphQL\TypeRegistry;

class ShopReviewType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopReview',
            'fields' => fn() => [
                'id'        => Type::nonNull(Type::int()),
                'orderId'   => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => $r['order_id']],
                'productId' => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => $r['product_id']],
                'buyerId'   => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => $r['buyer_id']],
                'sellerId'  => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => $r['seller_id']],
                'buyer'     => [
                    'type' => TypeRegistry::user(),
                    'resolve' => fn($r) => [
                        'id'       => $r['buyer_id'],
                        'username' => $r['buyer_username'] ?? null,
                        'avatar'   => $r['buyer_avatar']   ?? null,
                    ],
                ],
                'productTitle' => [
                    'type' => Type::string(),
                    'resolve' => fn($r) => $r['product_title'] ?? null,
                ],
                'rating'      => Type::nonNull(Type::int()),
                'content'     => Type::nonNull(Type::string()),
                'images'      => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(Type::string()))),
                    'resolve' => fn($r) => $r['images'] ?? [],
                ],
                'sellerReply' => ['type' => Type::string(), 'resolve' => fn($r) => $r['seller_reply'] ?? null],
                'repliedAt'   => ['type' => Type::string(), 'resolve' => fn($r) => $r['replied_at']   ?? null],
                'createdAt'   => ['type' => Type::nonNull(Type::string()), 'resolve' => fn($r) => $r['created_at']],
                'updatedAt'   => ['type' => Type::nonNull(Type::string()), 'resolve' => fn($r) => $r['updated_at']],
            ],
        ]);
    }
}
