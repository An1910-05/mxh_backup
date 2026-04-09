<?php

namespace App\GraphQL\Mutations;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use App\GraphQL\TypeRegistry;
use App\Services\PostService;
use App\Services\CommentService;
use App\Services\LikeService;
use App\Services\FollowService;
use App\Services\ProfileService;
use App\Services\FriendshipService;
use App\Services\StoryService;
use App\Services\NotificationService;
use App\Services\TaiXiuService;
use App\Validators\PostValidator;
use App\Validators\ProfileValidator;

class MutationType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'Mutation',
            'fields' => [

                'updateProfile' => [
                    'type' => TypeRegistry::profile(),
                    'args' => [
                        'bio' => Type::string(),
                        'avatar' => Type::string(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $errors = ProfileValidator::validateUpdate($args);
                        if (!empty($errors)) throw new \GraphQL\Error\Error(implode(', ', $errors));
                        $service = new ProfileService();
                        return $service->updateProfile($context['user']['id'], $args);
                    },
                ],

                'createPost' => [
                    'type' => TypeRegistry::post(),
                    'args' => [
                        'content' => Type::nonNull(Type::string()),
                        'media_url' => Type::string(),
                        'media_type' => Type::string(),
                        'media_width' => Type::int(),
                        'media_height' => Type::int(),
                        'location_label' => Type::string(),
                        'latitude' => Type::float(),
                        'longitude' => Type::float(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $errors = PostValidator::validateCreate($args);
                        if (!empty($errors)) throw new \GraphQL\Error\Error(implode(', ', $errors));
                        $service = new PostService();
                        return $service->createPost(
                            $context['user']['id'],
                            $args['content'],
                            $args['media_url'] ?? null,
                            $args['media_type'] ?? null,
                            $args['media_width'] ?? null,
                            $args['media_height'] ?? null,
                            isset($args['location_label']) ? trim((string)$args['location_label']) : null,
                            isset($args['latitude']) ? (float)$args['latitude'] : null,
                            isset($args['longitude']) ? (float)$args['longitude'] : null
                        );
                    },
                ],

                'editPost' => [
                    'type' => TypeRegistry::post(),
                    'args' => [
                        'postId' => Type::nonNull(Type::int()),
                        'content' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new PostService();
                        return $service->editPost($args['postId'], $context['user']['id'], $args['content']);
                    },
                ],

                'deletePost' => [
                    'type' => Type::boolean(),
                    'args' => ['postId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new PostService();
                        return $service->deletePost($args['postId'], $context['user']['id']);
                    },
                ],

                'likePost' => [
                    'type' => Type::boolean(),
                    'args' => [
                        'postId'       => Type::nonNull(Type::int()),
                        'reactionType' => ['type' => Type::string(), 'defaultValue' => 'like'],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new LikeService();
                        return $service->likePost($args['postId'], $context['user']['id'], $args['reactionType']);
                    },
                ],

                'unlikePost' => [
                    'type' => Type::boolean(),
                    'args' => ['postId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new LikeService();
                        return $service->unlikePost($args['postId'], $context['user']['id']);
                    },
                ],

                'createComment' => [
                    'type' => TypeRegistry::comment(),
                    'args' => [
                        'postId' => Type::nonNull(Type::int()),
                        'content' => Type::nonNull(Type::string()),
                        'media_url' => Type::string(),
                        'media_type' => Type::string(),
                        'media_width' => Type::int(),
                        'media_height' => Type::int(),
                        'parent_id' => Type::int(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $errors = PostValidator::validateComment([
                            'content' => $args['content'],
                            'media_url' => $args['media_url'] ?? null,
                        ]);
                        if (!empty($errors)) throw new \GraphQL\Error\Error(implode(', ', $errors));
                        $service = new CommentService();
                        return $service->createComment(
                            $args['postId'],
                            $context['user']['id'],
                            $args['content'],
                            $args['media_url'] ?? null,
                            $args['media_type'] ?? null,
                            $args['media_width'] ?? null,
                            $args['media_height'] ?? null,
                            $args['parent_id'] ?? null
                        );
                    },
                ],

                'deleteComment' => [
                    'type' => Type::boolean(),
                    'args' => [
                        'commentId' => Type::nonNull(Type::int()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CommentService();
                        return $service->deleteComment($args['commentId'], $context['user']['id']);
                    },
                ],

                'markNotificationRead' => [
                    'type' => Type::boolean(),
                    'args' => ['notificationId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $svc = new NotificationService();
                        return $svc->markRead($args['notificationId'], $context['user']['id']);
                    },
                ],

                'markAllNotificationsRead' => [
                    'type' => Type::int(),
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $svc = new NotificationService();
                        return $svc->markAllRead($context['user']['id']);
                    },
                ],

                'deleteNotification' => [
                    'type' => Type::boolean(),
                    'args' => ['notificationId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $svc = new NotificationService();
                        return $svc->delete($args['notificationId'], $context['user']['id']);
                    },
                ],

                'deleteAllNotifications' => [
                    'type' => Type::int(),
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $svc = new NotificationService();
                        return $svc->deleteAll($context['user']['id']);
                    },
                ],

                'followUser' => [
                    'type' => Type::boolean(),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FollowService();
                        return $service->follow($context['user']['id'], $args['userId']);
                    },
                ],

                'unfollowUser' => [
                    'type' => Type::boolean(),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FollowService();
                        return $service->unfollow($context['user']['id'], $args['userId']);
                    },
                ],

                'updateCustomUrl' => [
                    'type' => Type::string(),
                    'args' => [
                        'url' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $url = trim($args['url']);
                        if (!preg_match('/^[a-zA-Z0-9._]{3,30}$/', $url)) {
                            throw new \GraphQL\Error\Error('URL must be 3-30 characters, only letters, numbers, dots and underscores');
                        }
                        $reserved = ['login', 'register', 'search', 'friends', 'settings', 'admin', 'post', 'api', 'graphql', 'notifications'];
                        if (in_array(strtolower($url), $reserved)) {
                            throw new \GraphQL\Error\Error('This URL is reserved');
                        }
                        $userRepo = new \App\Repositories\UserRepository();
                        if ($userRepo->isCustomUrlTaken($url, $context['user']['id'])) {
                            throw new \GraphQL\Error\Error('This URL is already taken');
                        }
                        $userRepo->updateCustomUrl($context['user']['id'], $url);
                        return $url;
                    },
                ],

                'sendFriendRequest' => [
                    'type' => new \GraphQL\Type\Definition\ObjectType([
                        'name' => 'FriendRequestResult',
                        'fields' => [
                            'message' => Type::string(),
                            'status' => Type::string(),
                            'friendship_id' => Type::int(),
                        ],
                    ]),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        return $service->sendRequest($context['user']['id'], $args['userId']);
                    },
                ],

                'acceptFriendRequest' => [
                    'type' => Type::string(),
                    'args' => ['friendshipId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        $result = $service->acceptRequest($context['user']['id'], $args['friendshipId']);
                        return $result['message'];
                    },
                ],

                'rejectFriendRequest' => [
                    'type' => Type::string(),
                    'args' => ['friendshipId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        $result = $service->rejectRequest($context['user']['id'], $args['friendshipId']);
                        return $result['message'];
                    },
                ],

                'cancelFriendRequest' => [
                    'type' => Type::boolean(),
                    'args' => ['friendshipId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        return $service->cancelRequest($context['user']['id'], $args['friendshipId']);
                    },
                ],

                'cancelFriendRequestByUser' => [
                    'type' => Type::boolean(),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        return $service->cancelRequestByUser($context['user']['id'], $args['userId']);
                    },
                ],

                'unfriend' => [
                    'type' => Type::boolean(),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new FriendshipService();
                        return $service->unfriend($context['user']['id'], $args['userId']);
                    },
                ],

                'createStory' => [
                    'type' => TypeRegistry::story(),
                    'args' => [
                        'media_url' => Type::nonNull(Type::string()),
                        'media_type' => Type::nonNull(Type::string()),
                        'media_width' => Type::int(),
                        'media_height' => Type::int(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new StoryService();
                        return $service->createStory(
                            $context['user']['id'],
                            $args['media_url'],
                            $args['media_type'],
                            $args['media_width'] ?? null,
                            $args['media_height'] ?? null
                        );
                    },
                ],

                'deleteStory' => [
                    'type' => Type::boolean(),
                    'args' => ['storyId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new StoryService();
                        return $service->deleteStory($args['storyId'], $context['user']['id']);
                    },
                ],

                'taiXiuPlaceBet' => [
                    'type' => TypeRegistry::taiXiuPlaceBetResult(),
                    'args' => [
                        'side'   => Type::nonNull(Type::string()),
                        'amount' => Type::nonNull(Type::int()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new TaiXiuService();
                        return $service->placeBet(
                            (int) $context['user']['id'],
                            (string) $args['side'],
                            (int) $args['amount']
                        );
                    },
                ],

            ],
        ]);
    }

    private static function requireAuth(array $context): void
    {
        if (!$context['user']) {
            throw new \GraphQL\Error\Error('Unauthorized');
        }
    }
}
