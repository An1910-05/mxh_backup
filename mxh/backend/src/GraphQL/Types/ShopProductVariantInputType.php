<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\InputObjectType;

class ShopProductVariantInputType extends InputObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopProductVariantInput',
            'fields' => [
                'name'          => Type::nonNull(Type::string()),
                'price'         => Type::nonNull(Type::int()),
                'stockQuantity' => Type::int(),
                'image'         => Type::string(),
            ],
        ]);
    }
}
