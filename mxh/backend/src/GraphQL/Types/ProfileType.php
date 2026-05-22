<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class ProfileType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Profile',
            'fields' => fn() => [
                'user_id' => Type::nonNull(Type::int()),
                'username' => Type::nonNull(Type::string()),
                'email' => Type::string(),
                'custom_url' => Type::string(),
                'bio' => Type::string(),
                'avatar' => Type::string(),
                'cover_photo' => Type::string(),
                'post_count' => Type::int(),
                'follower_count' => Type::int(),
                'following_count' => Type::int(),
                'friend_count' => Type::int(),
                'is_following' => Type::boolean(),
                'friendship_status' => Type::string(),
                'friendship_id' => Type::int(),
                'friendship_is_sender' => Type::boolean(),
                'is_verified' => [
                    'type' => Type::boolean(),
                    'resolve' => fn($row) => !empty($row['is_verified']),
                ],
                'verified_until' => Type::string(),
                'last_login_device' => Type::string(),
                'created_at' => Type::string(),
            ],
        ]);
    }
}
