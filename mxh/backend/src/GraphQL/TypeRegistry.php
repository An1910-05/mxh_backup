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
use App\GraphQL\Types\LikerType;
use App\GraphQL\Types\TaiXiuRoundType;
use App\GraphQL\Types\TaiXiuBetType;
use App\GraphQL\Types\TaiXiuOverviewType;
use App\GraphQL\Types\TaiXiuPlayResultType;
use App\GraphQL\Types\TaiXiuCurrentRoundType;
use App\GraphQL\Types\TaiXiuPlaceBetResultType;

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
    private static ?LikerType $liker = null;
    private static ?TaiXiuRoundType $taiXiuRound = null;
    private static ?TaiXiuBetType $taiXiuBet = null;
    private static ?TaiXiuOverviewType $taiXiuOverview = null;
    private static ?TaiXiuPlayResultType $taiXiuPlayResult = null;
    private static ?TaiXiuCurrentRoundType $taiXiuCurrentRound = null;
    private static ?TaiXiuPlaceBetResultType $taiXiuPlaceBetResult = null;

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
    public static function liker(): LikerType { return self::$liker ??= new LikerType(); }
    public static function taiXiuRound(): TaiXiuRoundType { return self::$taiXiuRound ??= new TaiXiuRoundType(); }
    public static function taiXiuBet(): TaiXiuBetType { return self::$taiXiuBet ??= new TaiXiuBetType(); }
    public static function taiXiuOverview(): TaiXiuOverviewType { return self::$taiXiuOverview ??= new TaiXiuOverviewType(); }
    public static function taiXiuPlayResult(): TaiXiuPlayResultType { return self::$taiXiuPlayResult ??= new TaiXiuPlayResultType(); }
    public static function taiXiuCurrentRound(): TaiXiuCurrentRoundType { return self::$taiXiuCurrentRound ??= new TaiXiuCurrentRoundType(); }
    public static function taiXiuPlaceBetResult(): TaiXiuPlaceBetResultType { return self::$taiXiuPlaceBetResult ??= new TaiXiuPlaceBetResultType(); }
}
