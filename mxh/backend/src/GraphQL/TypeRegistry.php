<?php

namespace App\GraphQL;

use App\GraphQL\Types\UserType;
use App\GraphQL\Types\ProfileType;
use App\GraphQL\Types\PostType;
use App\GraphQL\Types\CommentType;
use App\GraphQL\Types\FriendshipType;
use App\GraphQL\Types\FriendRequestType;
use App\GraphQL\Types\SearchUserType;
use App\GraphQL\Types\StoryType;
use App\GraphQL\Types\StoryGroupType;
use App\GraphQL\Types\NotificationType;

class TypeRegistry
{
    private static ?UserType $user = null;
    private static ?ProfileType $profile = null;
    private static ?PostType $post = null;
    private static ?CommentType $comment = null;
    private static ?FriendshipType $friendship = null;
    private static ?FriendRequestType $friendRequest = null;
    private static ?SearchUserType $searchUser = null;
    private static ?StoryType $story = null;
    private static ?StoryGroupType $storyGroup = null;
    private static ?NotificationType $notification = null;

    public static function user(): UserType { return self::$user ??= new UserType(); }
    public static function profile(): ProfileType { return self::$profile ??= new ProfileType(); }
    public static function post(): PostType { return self::$post ??= new PostType(); }
    public static function comment(): CommentType { return self::$comment ??= new CommentType(); }
    public static function friendship(): FriendshipType { return self::$friendship ??= new FriendshipType(); }
    public static function friendRequest(): FriendRequestType { return self::$friendRequest ??= new FriendRequestType(); }
    public static function searchUser(): SearchUserType { return self::$searchUser ??= new SearchUserType(); }
    public static function story(): StoryType { return self::$story ??= new StoryType(); }
    public static function storyGroup(): StoryGroupType { return self::$storyGroup ??= new StoryGroupType(); }
    public static function notification(): NotificationType { return self::$notification ??= new NotificationType(); }
}
