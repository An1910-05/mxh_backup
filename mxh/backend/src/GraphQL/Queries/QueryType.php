<?php

namespace App\GraphQL\Queries;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use App\GraphQL\TypeRegistry;
use App\Services\PostService;
use App\Services\ProfileService;
use App\Services\FriendshipService;
use App\Services\StoryService;
use App\Services\NotificationService;
use App\Services\LikeService;
use App\Services\TaiXiuService;
use App\Repositories\UserRepository;

class QueryType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Query',
            'fields' => [

                'me' => [
                    'type' => TypeRegistry::user(),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        return $context['user'];
                    },
                ],

                'user' => [
                    'type' => TypeRegistry::user(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $repo = new UserRepository();
                        $user = $repo->findById($args['id']);
                        if (!$user) throw new \GraphQL\Error\Error('User not found');
                        return $user;
                    },
                ],

                'userByCustomUrl' => [
                    'type' => TypeRegistry::user(),
                    'args' => ['url' => Type::nonNull(Type::string())],
                    'resolve' => function ($root, $args) {
                        $repo = new UserRepository();
                        $user = $repo->findByCustomUrl($args['url']);
                        if (!$user) throw new \GraphQL\Error\Error('User not found');
                        return $user;
                    },
                ],

                'profile' => [
                    'type' => TypeRegistry::profile(),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        $service = new ProfileService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getProfile($args['userId'], $currentUserId);
                    },
                ],

                'profileByCustomUrl' => [
                    'type' => TypeRegistry::profile(),
                    'args' => ['url' => Type::nonNull(Type::string())],
                    'resolve' => function ($root, $args, $context) {
                        $service = new ProfileService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getProfileByCustomUrl($args['url'], $currentUserId);
                    },
                ],

                'searchUsers' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => [
                        'query' => Type::nonNull(Type::string()),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                    ],
                    'resolve' => function ($root, $args) {
                        $q = trim($args['query']);
                        if (strlen($q) < 1) return [];
                        $repo = new UserRepository();
                        return $repo->search($q, $args['limit']);
                    },
                ],

                'posts' => [
                    'type' => Type::listOf(TypeRegistry::post()),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $service = new PostService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getPosts($args['limit'], $args['page'], $currentUserId);
                    },
                ],

                'post' => [
                    'type' => TypeRegistry::post(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        $service = new PostService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getPost($args['id'], $currentUserId);
                    },
                ],

                'feed' => [
                    'type' => Type::listOf(TypeRegistry::post()),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new PostService();
                        return $service->getFeed($context['user']['id'], $args['limit'], $args['page']);
                    },
                ],

                'comments' => [
                    'type' => Type::listOf(TypeRegistry::comment()),
                    'args' => ['postId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new \App\Services\CommentService();
                        return $service->getCommentsByPost($args['postId']);
                    },
                ],

                'userPosts' => [
                    'type' => Type::listOf(TypeRegistry::post()),
                    'args' => [
                        'userId' => Type::nonNull(Type::int()),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        $service = new PostService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getUserPosts($args['userId'], $args['limit'], $args['page'], $currentUserId);
                    },
                ],

                'notifications' => [
                    'type' => Type::listOf(TypeRegistry::notification()),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 40],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $svc = new NotificationService();
                        return $svc->listForUser($context['user']['id'], $args['limit'], $args['page']);
                    },
                ],

                'notificationUnreadCount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $svc = new NotificationService();
                        return $svc->unreadCount($context['user']['id']);
                    },
                ],

                'myFriends' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new FriendshipService();
                        return $service->getFriends($context['user']['id']);
                    },
                ],

                'userFriends' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new FriendshipService();
                        return $service->getFriends($args['userId']);
                    },
                ],

                'userFollowers' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $repo = new \App\Repositories\FollowRepository();
                        return $repo->getFollowers($args['userId']);
                    },
                ],

                'userFollowing' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $repo = new \App\Repositories\FollowRepository();
                        return $repo->getFollowing($args['userId']);
                    },
                ],

                'pendingFriendRequests' => [
                    'type' => Type::listOf(TypeRegistry::friendRequest()),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new FriendshipService();
                        return $service->getPendingReceived($context['user']['id']);
                    },
                ],

                'sentFriendRequests' => [
                    'type' => Type::listOf(TypeRegistry::friendRequest()),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new FriendshipService();
                        return $service->getPendingSent($context['user']['id']);
                    },
                ],

                'feedStories' => [
                    'type' => Type::listOf(TypeRegistry::storyGroup()),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new StoryService();
                        return $service->getFeedStories($context['user']['id']);
                    },
                ],

                'userStories' => [
                    'type' => Type::listOf(TypeRegistry::story()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new StoryService();
                        return $service->getUserStories($args['userId']);
                    },
                ],

                'postLikers' => [
                    'type' => Type::listOf(TypeRegistry::liker()),
                    'args' => [
                        'postId' => Type::nonNull(Type::int()),
                        'limit'  => ['type' => Type::int(), 'defaultValue' => 50],
                    ],
                    'resolve' => function ($root, $args) {
                        $service = new LikeService();
                        return $service->getPostLikers($args['postId'], $args['limit']);
                    },
                ],

                'taiXiuOverview' => [
                    'type' => TypeRegistry::taiXiuOverview(),
                    'args' => [
                        'roundLimit' => ['type' => Type::int(), 'defaultValue' => 18],
                        'betLimit' => ['type' => Type::int(), 'defaultValue' => 12],
                        'jackpotLimit' => ['type' => Type::int(), 'defaultValue' => 10],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new TaiXiuService();
                        return $service->getOverview(
                            (int) $context['user']['id'],
                            (int) $args['roundLimit'],
                            (int) $args['betLimit'],
                            (int) $args['jackpotLimit']
                        );
                    },
                ],

                'taiXiuBetHistory' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuBet()))),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new TaiXiuService();
                        return $service->getBetHistory((int) $context['user']['id'], (int) $args['limit'], (int) $args['page']);
                    },
                ],

                'taiXiuRoundHistory' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuRound()))),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new TaiXiuService();
                        return $service->getRoundHistory((int) $args['limit']);
                    },
                ],

                'taiXiuJackpotHistory' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::taiXiuRound()))),
                    'args' => [
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new TaiXiuService();
                        return $service->getJackpotHistory((int) $args['limit']);
                    },
                ],

                'taiXiuCurrentRound' => [
                    'type' => TypeRegistry::taiXiuCurrentRound(),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new TaiXiuService();
                        return $service->getCurrentRound((int) $context['user']['id']);
                    },
                ],

            ],
        ]);
    }
}
