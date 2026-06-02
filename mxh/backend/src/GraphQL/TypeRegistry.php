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
use App\GraphQL\Types\ShopCategoryType;
use App\GraphQL\Types\ShopProductType;
use App\GraphQL\Types\ShopProductVariantType;
use App\GraphQL\Types\ShopProductVariantInputType;
use App\GraphQL\Types\ShopOrderType;
use App\GraphQL\Types\ShopSellerApplicationType;
use App\GraphQL\Types\ShopReviewType;
use App\GraphQL\Types\ShopReviewStatsType;
use App\GraphQL\Types\CaroRoomType;
use App\GraphQL\Types\CaroPlayerType;
use App\GraphQL\Types\CaroMoveType;

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
    private static ?ShopCategoryType $shopCategory = null;
    private static ?ShopProductType $shopProduct = null;
    private static ?ShopProductVariantType $shopProductVariant = null;
    private static ?ShopProductVariantInputType $shopProductVariantInput = null;
    private static ?ShopOrderType $shopOrder = null;
    private static ?ShopSellerApplicationType $shopSellerApplication = null;
    private static ?ShopReviewType $shopReview = null;
    private static ?ShopReviewStatsType $shopReviewStats = null;
    private static ?CaroRoomType $caroRoom = null;
    private static ?CaroPlayerType $caroPlayer = null;
    private static ?CaroMoveType $caroMove = null;

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
    public static function shopCategory(): ShopCategoryType { return self::$shopCategory ??= new ShopCategoryType(); }
    public static function shopProduct(): ShopProductType { return self::$shopProduct ??= new ShopProductType(); }
    public static function shopProductVariant(): ShopProductVariantType { return self::$shopProductVariant ??= new ShopProductVariantType(); }
    public static function shopProductVariantInput(): ShopProductVariantInputType { return self::$shopProductVariantInput ??= new ShopProductVariantInputType(); }
    public static function shopOrder(): ShopOrderType { return self::$shopOrder ??= new ShopOrderType(); }
    public static function shopSellerApplication(): ShopSellerApplicationType { return self::$shopSellerApplication ??= new ShopSellerApplicationType(); }
    public static function shopReview(): ShopReviewType { return self::$shopReview ??= new ShopReviewType(); }
    public static function shopReviewStats(): ShopReviewStatsType { return self::$shopReviewStats ??= new ShopReviewStatsType(); }
    public static function caroRoom(): CaroRoomType { return self::$caroRoom ??= new CaroRoomType(); }
    public static function caroPlayer(): CaroPlayerType { return self::$caroPlayer ??= new CaroPlayerType(); }
    public static function caroMove(): CaroMoveType { return self::$caroMove ??= new CaroMoveType(); }
}
