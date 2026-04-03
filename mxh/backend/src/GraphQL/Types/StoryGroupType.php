<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use App\GraphQL\TypeRegistry;

class StoryGroupType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'StoryGroup',
            'fields' => fn() => [
                'user_id' => Type::nonNull(Type::int()),
                'username' => Type::string(),
                'user_avatar' => Type::string(),
                'stories' => Type::listOf(TypeRegistry::story()),
            ],
        ]);
    }
}
