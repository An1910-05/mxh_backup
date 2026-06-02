<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;

class ShopProductVariantType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopProductVariant',
            'fields' => fn() => [
                'id'        => Type::nonNull(Type::int()),
                'productId' => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => $r['product_id']],
                'name'      => Type::nonNull(Type::string()),
                'price'     => Type::nonNull(Type::int()),
                'stockQuantity' => ['type' => Type::int(), 'resolve' => fn($r) => $r['stock_quantity']],
                'image'     => ['type' => Type::string(), 'resolve' => fn($r) => $r['image'] ?? null],
                'displayOrder' => ['type' => Type::nonNull(Type::int()), 'resolve' => fn($r) => (int) ($r['display_order'] ?? 0)],
            ],
        ]);
    }
}
