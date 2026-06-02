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
use App\Services\CaroService;
use App\Services\ShopProductService;
use App\Services\ShopOrderService;
use App\Services\ShopSellerService;
use App\Services\ShopReviewService;
use App\Repositories\ShopCategoryRepository;
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

                // Shop Mutations
                'createShopProduct' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => [
                        'categoryId' => Type::nonNull(Type::int()),
                        'title' => Type::nonNull(Type::string()),
                        'description' => Type::nonNull(Type::string()),
                        'productType' => Type::nonNull(Type::string()),
                        'price' => Type::nonNull(Type::int()),
                        'stockQuantity' => Type::int(),
                        'images' => Type::nonNull(Type::listOf(Type::nonNull(Type::string()))),
                        'digitalFileUrl' => Type::string(),
                        'variants' => Type::listOf(Type::nonNull(TypeRegistry::shopProductVariantInput())),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        (new ShopSellerService())->requireSeller((int)$context['user']['id']);
                        $service = new ShopProductService();
                        $data = [
                            'category_id'      => $args['categoryId'],
                            'title'            => $args['title'],
                            'description'     => $args['description'],
                            'product_type'    => $args['productType'],
                            'price'           => $args['price'],
                            'stock_quantity'  => $args['stockQuantity'] ?? null,
                            'images'          => $args['images'],
                            'digital_file_url'=> $args['digitalFileUrl'] ?? null,
                        ];
                        if (!empty($args['variants'])) {
                            $data['variants'] = array_map(fn($v) => [
                                'name'           => $v['name'],
                                'price'          => $v['price'],
                                'stock_quantity' => $v['stockQuantity'] ?? null,
                                'image'          => $v['image'] ?? null,
                            ], $args['variants']);
                        }
                        return $service->createProduct($context['user']['id'], $data);
                    },
                ],

                'registerShopSeller' => [
                    'type' => TypeRegistry::shopSellerApplication(),
                    'args' => [
                        'storeName' => Type::nonNull(Type::string()),
                        'intro' => Type::nonNull(Type::string()),
                        'phone' => Type::nonNull(Type::string()),
                        'address' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopSellerService();
                        return $service->register((int)$context['user']['id'], [
                            'store_name' => $args['storeName'],
                            'intro' => $args['intro'],
                            'phone' => $args['phone'],
                            'address' => $args['address'],
                        ]);
                    },
                ],

                'approveShopSeller' => [
                    'type' => TypeRegistry::shopSellerApplication(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopSellerService();
                        return $service->approve((int)$args['id'], (int)$context['user']['id']);
                    },
                ],

                'rejectShopSeller' => [
                    'type' => TypeRegistry::shopSellerApplication(),
                    'args' => [
                        'id' => Type::nonNull(Type::int()),
                        'reason' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopSellerService();
                        return $service->reject((int)$args['id'], (int)$context['user']['id'], (string)$args['reason']);
                    },
                ],

                'updateShopProduct' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => [
                        'id' => Type::nonNull(Type::int()),
                        'categoryId' => Type::int(),
                        'title' => Type::string(),
                        'description' => Type::string(),
                        'price' => Type::int(),
                        'stockQuantity' => Type::int(),
                        'images' => Type::listOf(Type::nonNull(Type::string())),
                        'digitalFileUrl' => Type::string(),
                        'variants' => Type::listOf(Type::nonNull(TypeRegistry::shopProductVariantInput())),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopProductService();
                        $productId = $args['id'];
                        // Map camelCase args -> snake_case keys the Service/Repository expect.
                        // Only include keys actually provided so partial updates stay partial.
                        $map = [
                            'categoryId'     => 'category_id',
                            'title'          => 'title',
                            'description'    => 'description',
                            'price'          => 'price',
                            'stockQuantity'  => 'stock_quantity',
                            'images'         => 'images',
                            'digitalFileUrl' => 'digital_file_url',
                        ];
                        $data = [];
                        foreach ($map as $camel => $snake) {
                            if (array_key_exists($camel, $args)) {
                                $data[$snake] = $args[$camel];
                            }
                        }
                        if (array_key_exists('variants', $args)) {
                            $data['variants'] = is_array($args['variants']) ? array_map(fn($v) => [
                                'name'           => $v['name'],
                                'price'          => $v['price'],
                                'stock_quantity' => $v['stockQuantity'] ?? null,
                                'image'          => $v['image'] ?? null,
                            ], $args['variants']) : [];
                        }
                        return $service->updateProduct($productId, $context['user']['id'], $data);
                    },
                ],

                'deleteShopProduct' => [
                    'type' => Type::boolean(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopProductService();
                        return $service->deleteProduct($args['id'], $context['user']['id']);
                    },
                ],

                'submitShopProductForApproval' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopProductService();
                        return $service->submitForApproval($args['id'], $context['user']['id']);
                    },
                ],

                'createShopOrder' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => [
                        'productId' => Type::nonNull(Type::int()),
                        'variantId' => Type::int(),
                        'quantity' => Type::nonNull(Type::int()),
                        'shippingAddress' => Type::string(),
                        'buyerNotes' => Type::string(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopOrderService();
                        $shipping = $args['shippingAddress'] ?? null;
                        if (is_string($shipping)) {
                            $trim = trim($shipping);
                            if ($trim === '') {
                                $shipping = null;
                            } else {
                                $decoded = json_decode($trim, true);
                                $shipping = (is_array($decoded) && $decoded) ? $decoded : ['text' => $trim];
                            }
                        }
                        $data = [
                            'product_id' => $args['productId'],
                            'variant_id' => $args['variantId'] ?? null,
                            'quantity' => $args['quantity'],
                            'shipping_address' => $shipping,
                            'buyer_notes' => $args['buyerNotes'] ?? null,
                        ];
                        return $service->createOrder($context['user']['id'], $data);
                    },
                ],

                'confirmShopOrder' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => ['orderId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopOrderService();
                        return $service->confirmOrder($args['orderId'], $context['user']['id']);
                    },
                ],

                'shipShopOrder' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => [
                        'orderId' => Type::nonNull(Type::int()),
                        'trackingNumber' => Type::string(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopOrderService();
                        return $service->shipOrder($args['orderId'], $context['user']['id'], $args['trackingNumber'] ?? null);
                    },
                ],

                'confirmDelivery' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => ['orderId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopOrderService();
                        return $service->confirmDelivery($args['orderId'], $context['user']['id']);
                    },
                ],

                'cancelShopOrder' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => [
                        'orderId' => Type::nonNull(Type::int()),
                        'reason' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopOrderService();
                        $order = $service->getOrderById($args['orderId']);
                        if (!$order) throw new \GraphQL\Error\Error('Order not found');

                        $userId = $context['user']['id'];
                        $cancelledBy = ($order['buyer_id'] == $userId) ? 'buyer' : 'seller';

                        return $service->cancelOrder($args['orderId'], $userId, $args['reason'], $cancelledBy);
                    },
                ],

                'approveShopProduct' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopProductService();
                        return $service->approveProduct($args['id'], $context['user']['id']);
                    },
                ],

                'rejectShopProduct' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => [
                        'id' => Type::nonNull(Type::int()),
                        'reason' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopProductService();
                        return $service->rejectProduct($args['id'], $context['user']['id'], $args['reason']);
                    },
                ],

                'createShopCategory' => [
                    'type' => TypeRegistry::shopCategory(),
                    'args' => [
                        'name' => Type::nonNull(Type::string()),
                        'slug' => Type::nonNull(Type::string()),
                        'description' => Type::string(),
                        'icon' => Type::string(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $repo = new ShopCategoryRepository();
                        $categoryId = $repo->create($args);
                        return $repo->findById($categoryId);
                    },
                ],

                'updateShopCategory' => [
                    'type' => TypeRegistry::shopCategory(),
                    'args' => [
                        'id' => Type::nonNull(Type::int()),
                        'name' => Type::string(),
                        'description' => Type::string(),
                        'icon' => Type::string(),
                        'displayOrder' => Type::int(),
                        'isActive' => Type::boolean(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $repo = new ShopCategoryRepository();
                        $categoryId = $args['id'];
                        unset($args['id']);

                        $updateData = [];
                        if (isset($args['name'])) $updateData['name'] = $args['name'];
                        if (isset($args['description'])) $updateData['description'] = $args['description'];
                        if (isset($args['icon'])) $updateData['icon'] = $args['icon'];
                        if (isset($args['displayOrder'])) $updateData['display_order'] = $args['displayOrder'];
                        if (isset($args['isActive'])) $updateData['is_active'] = $args['isActive'];

                        $repo->update($categoryId, $updateData);
                        return $repo->findById($categoryId);
                    },
                ],

                // ── Shop Reviews ──────────────────────────────────────
                'createShopReview' => [
                    'type' => TypeRegistry::shopReview(),
                    'args' => [
                        'orderId' => Type::nonNull(Type::int()),
                        'rating'  => Type::nonNull(Type::int()),
                        'content' => Type::nonNull(Type::string()),
                        'images'  => Type::listOf(Type::nonNull(Type::string())),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopReviewService();
                        return $service->createReview((int)$context['user']['id'], [
                            'order_id' => (int)$args['orderId'],
                            'rating'   => (int)$args['rating'],
                            'content'  => (string)$args['content'],
                            'images'   => $args['images'] ?? null,
                        ]);
                    },
                ],

                'updateShopReview' => [
                    'type' => TypeRegistry::shopReview(),
                    'args' => [
                        'id'      => Type::nonNull(Type::int()),
                        'rating'  => Type::int(),
                        'content' => Type::string(),
                        'images'  => Type::listOf(Type::nonNull(Type::string())),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopReviewService();
                        $update = [];
                        if (isset($args['rating']))  $update['rating']  = (int)$args['rating'];
                        if (isset($args['content'])) $update['content'] = (string)$args['content'];
                        if (array_key_exists('images', $args)) $update['images'] = $args['images'];
                        return $service->updateReview((int)$args['id'], (int)$context['user']['id'], $update);
                    },
                ],

                'replyShopReview' => [
                    'type' => TypeRegistry::shopReview(),
                    'args' => [
                        'id'    => Type::nonNull(Type::int()),
                        'reply' => Type::nonNull(Type::string()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ShopReviewService();
                        return $service->replyToReview((int)$args['id'], (int)$context['user']['id'], (string)$args['reply']);
                    },
                ],

                'deleteShopReview' => [
                    'type' => Type::boolean(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $isAdmin = (($context['user']['role'] ?? 'user') === 'admin');
                        $service = new ShopReviewService();
                        return $service->deleteReview((int)$args['id'], (int)$context['user']['id'], $isAdmin);
                    },
                ],

                // ── Caro (cờ caro) ─────────────────────────────────────
                'caroCreateRoom' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => [
                        'name'       => Type::string(),
                        'visibility' => Type::string(),    // 'private' | 'public'
                        'password'   => Type::string(),
                        'boardSize'  => Type::int(),
                        'winLength'  => Type::int(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->createRoom((int) $context['user']['id'], [
                            'name'       => $args['name'] ?? null,
                            'visibility' => $args['visibility'] ?? 'private',
                            'password'   => $args['password'] ?? null,
                            'board_size' => $args['boardSize'] ?? null,
                            'win_length' => $args['winLength'] ?? null,
                        ]);
                    },
                ],

                'caroJoinByCode' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => [
                        'code'     => Type::nonNull(Type::string()),
                        'password' => Type::string(),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->joinByCode(
                            (int) $context['user']['id'],
                            (string) $args['code'],
                            $args['password'] ?? null
                        );
                    },
                ],

                'caroRandomMatch' => [
                    'type' => TypeRegistry::caroRoom(),
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->randomMatch((int) $context['user']['id']);
                    },
                ],

                'caroMakeMove' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => [
                        'roomId' => Type::nonNull(Type::int()),
                        'row'    => Type::nonNull(Type::int()),
                        'col'    => Type::nonNull(Type::int()),
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->makeMove(
                            (int) $context['user']['id'],
                            (int) $args['roomId'],
                            (int) $args['row'],
                            (int) $args['col']
                        );
                    },
                ],

                'caroLeaveRoom' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => ['roomId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        $result = $service->leaveRoom((int) $context['user']['id'], (int) $args['roomId']);
                        if (isset($result['deleted'])) return null;
                        return $result;
                    },
                ],

                'caroRequestRematch' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => ['roomId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->requestRematch((int) $context['user']['id'], (int) $args['roomId']);
                    },
                ],

                'caroDeclineRematch' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => ['roomId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new CaroService();
                        return $service->declineRematch((int) $context['user']['id'], (int) $args['roomId']);
                    },
                ],

                // ── Tích xanh xác thực ──────────────────────────────────
                'purchaseVerified' => [
                    'type' => TypeRegistry::profile(),
                    'args' => [
                        'duration' => Type::string(), // 'monthly' | 'yearly'
                    ],
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service  = new ProfileService();
                        $duration = $args['duration'] ?? 'monthly';
                        return $service->purchaseVerified((int) $context['user']['id'], $duration);
                    },
                ],

                'cancelVerified' => [
                    'type' => TypeRegistry::profile(),
                    'resolve' => function ($root, $args, $context) {
                        self::requireAuth($context);
                        $service = new ProfileService();
                        return $service->cancelVerified((int) $context['user']['id']);
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
