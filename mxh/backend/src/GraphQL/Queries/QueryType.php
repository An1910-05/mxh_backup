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
use App\Services\CaroService;
use App\Services\ShopProductService;
use App\Services\ShopOrderService;
use App\Services\ShopSellerService;
use App\Services\ShopReviewService;
use App\Services\GhnTrackingService;
use App\Repositories\ShopCategoryRepository;
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
                    'resolve' => function ($root, $args, $context) {
                        $currentUserId = $context['user']['id'] ?? null;
                        if (!(new \App\Services\PrivacyService())->canView($currentUserId, $args['userId'])) return [];
                        $service = new FriendshipService();
                        return $service->getFriends($args['userId']);
                    },
                ],

                'userFollowers' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        $currentUserId = $context['user']['id'] ?? null;
                        if (!(new \App\Services\PrivacyService())->canView($currentUserId, $args['userId'])) return [];
                        $repo = new \App\Repositories\FollowRepository();
                        return $repo->getFollowers($args['userId']);
                    },
                ],

                'userFollowing' => [
                    'type' => Type::listOf(TypeRegistry::searchUser()),
                    'args' => ['userId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        $currentUserId = $context['user']['id'] ?? null;
                        if (!(new \App\Services\PrivacyService())->canView($currentUserId, $args['userId'])) return [];
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
                    'resolve' => function ($root, $args, $context) {
                        $service = new StoryService();
                        $currentUserId = $context['user']['id'] ?? null;
                        return $service->getUserStories($args['userId'], $currentUserId);
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

                // Shop Queries
                'shopCategories' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopCategory()))),
                    'resolve' => function ($root, $args) {
                        $repo = new ShopCategoryRepository();
                        return $repo->findAll();
                    },
                ],

                'shopCategory' => [
                    'type' => TypeRegistry::shopCategory(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $repo = new ShopCategoryRepository();
                        $category = $repo->findById($args['id']);
                        if (!$category) throw new \GraphQL\Error\Error('Category not found');
                        return $category;
                    },
                ],

                'shopProducts' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopProduct()))),
                    'args' => [
                        'categoryId' => Type::int(),
                        'sellerId' => Type::int(),
                        'status' => Type::string(),
                        'productType' => Type::string(),
                        'search' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args) {
                        $service = new ShopProductService();
                        $filters = [
                            'category_id' => $args['categoryId'] ?? null,
                            'seller_id' => $args['sellerId'] ?? null,
                            'status' => $args['status'] ?? 'approved',
                            'product_type' => $args['productType'] ?? null,
                            'search' => $args['search'] ?? null,
                        ];
                        return $service->getProducts($filters, $args['limit'], $args['page']);
                    },
                ],

                'shopProduct' => [
                    'type' => TypeRegistry::shopProduct(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new ShopProductService();
                        $product = $service->getProductById($args['id'], true);
                        if (!$product) throw new \GraphQL\Error\Error('Product not found');
                        return $product;
                    },
                ],

                'myShopProducts' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopProduct()))),
                    'args' => [
                        'status' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopProductService();
                        $filters = [
                            'seller_id' => $context['user']['id'],
                            'status' => $args['status'] ?? null,
                        ];
                        return $service->getProducts($filters, $args['limit'], $args['page']);
                    },
                ],

                'myPurchases' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopOrder()))),
                    'args' => [
                        'status' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopOrderService();
                        $filters = [
                            'buyer_id' => $context['user']['id'],
                            'status' => $args['status'] ?? null,
                        ];
                        return $service->getOrders($filters, $args['limit'], $args['page']);
                    },
                ],

                'mySales' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopOrder()))),
                    'args' => [
                        'status' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopOrderService();
                        $filters = [
                            'seller_id' => $context['user']['id'],
                            'status' => $args['status'] ?? null,
                        ];
                        return $service->getOrders($filters, $args['limit'], $args['page']);
                    },
                ],

                'shopOrder' => [
                    'type' => TypeRegistry::shopOrder(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopOrderService();
                        $order = $service->getOrderById($args['id']);
                        if (!$order) throw new \GraphQL\Error\Error('Order not found');

                        $userId = $context['user']['id'];
                        $isAdmin = ($context['user']['role'] ?? 'user') === 'admin';
                        if ($order['buyer_id'] != $userId && $order['seller_id'] != $userId && !$isAdmin) {
                            throw new \GraphQL\Error\Error('Unauthorized to view this order');
                        }

                        return $order;
                    },
                ],

                'orderTracking' => [
                    'type' => Type::listOf(TypeRegistry::trackingStep()),
                    'args' => ['orderId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        try {
                            $service = new ShopOrderService();
                            $order = $service->getOrderById($args['orderId']);
                            if (!$order) throw new \Exception('Không tìm thấy đơn hàng', 404);

                            $userId = $context['user']['id'];
                            $isAdmin = ($context['user']['role'] ?? 'user') === 'admin';
                            if ($order['buyer_id'] != $userId && $order['seller_id'] != $userId && !$isAdmin) {
                                throw new \Exception('Bạn không có quyền xem đơn này', 403);
                            }

                            $tracking = trim((string)($order['tracking_number'] ?? ''));
                            if ($tracking === '') throw new \Exception('Đơn chưa có mã vận đơn để tra cứu', 400);

                            $carrier = (string)($order['shipping_carrier'] ?? '');
                            if (stripos($carrier, 'GHN') !== false || stripos($carrier, 'Giao Hàng Nhanh') !== false) {
                                return (new GhnTrackingService())->track($tracking);
                            }
                            throw new \Exception('Tra cứu lộ trình cho "' . ($carrier ?: 'đơn vị này') . '" chưa được hỗ trợ', 400);
                        } catch (\GraphQL\Error\Error $e) {
                            throw $e;
                        } catch (\Throwable $e) {
                            // Lỗi nghiệp vụ (4xx) hoặc lỗi gọi carrier (5xx) -> message sạch cho user.
                            $code = (int) $e->getCode();
                            if ($code >= 400 && $code < 600) throw new \GraphQL\Error\Error($e->getMessage());
                            throw $e;
                        }
                    },
                ],

                'adminShopProducts' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopProduct()))),
                    'args' => [
                        'status' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopProductService();
                        $filters = ['status' => $args['status'] ?? 'pending'];
                        return $service->getProducts($filters, $args['limit'], $args['page']);
                    },
                ],

                'adminShopOrders' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopOrder()))),
                    'args' => [
                        'status' => Type::string(),
                        'limit' => ['type' => Type::int(), 'defaultValue' => 20],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopOrderService();
                        $filters = ['status' => $args['status'] ?? null];
                        return $service->getOrders($filters, $args['limit'], $args['page']);
                    },
                ],

                'myShopApplication' => [
                    'type' => TypeRegistry::shopSellerApplication(),
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopSellerService();
                        return $service->getMyApplication((int)$context['user']['id']);
                    },
                ],

                'shopSellerApplications' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopSellerApplication()))),
                    'args' => [
                        'status' => ['type' => Type::string(), 'defaultValue' => 'pending'],
                        'limit' => ['type' => Type::int(), 'defaultValue' => 50],
                        'page' => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        if (($context['user']['role'] ?? 'user') !== 'admin') {
                            throw new \GraphQL\Error\Error('Admin access required');
                        }
                        $service = new ShopSellerService();
                        return $service->listByStatus($args['status'], $args['limit'], $args['page']);
                    },
                ],

                // ── Shop Reviews ──────────────────────────────────────
                'productReviews' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopReview()))),
                    'args' => [
                        'productId' => Type::nonNull(Type::int()),
                        'rating'    => Type::int(),
                        'limit'     => ['type' => Type::int(), 'defaultValue' => 20],
                        'page'      => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args) {
                        $service = new ShopReviewService();
                        return $service->getProductReviews(
                            (int)$args['productId'],
                            isset($args['rating']) ? (int)$args['rating'] : null,
                            (int)$args['limit'],
                            (int)$args['page']
                        );
                    },
                ],

                'productReviewStats' => [
                    'type' => Type::nonNull(TypeRegistry::shopReviewStats()),
                    'args' => ['productId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new ShopReviewService();
                        return $service->getStatsForProduct((int)$args['productId']);
                    },
                ],

                'sellerReviews' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::shopReview()))),
                    'args' => [
                        'sellerId' => Type::nonNull(Type::int()),
                        'limit'    => ['type' => Type::int(), 'defaultValue' => 20],
                        'page'     => ['type' => Type::int(), 'defaultValue' => 1],
                    ],
                    'resolve' => function ($root, $args) {
                        $service = new ShopReviewService();
                        return $service->getSellerReviews((int)$args['sellerId'], (int)$args['limit'], (int)$args['page']);
                    },
                ],

                'sellerReviewStats' => [
                    'type' => Type::nonNull(TypeRegistry::shopReviewStats()),
                    'args' => ['sellerId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args) {
                        $service = new ShopReviewService();
                        $s = $service->getStatsForSeller((int)$args['sellerId']);
                        // Bù field còn thiếu so với ShopReviewStats schema
                        return $s + ['star5' => 0, 'star4' => 0, 'star3' => 0, 'star2' => 0, 'star1' => 0, 'withImages' => 0];
                    },
                ],

                'myReviewForOrder' => [
                    'type' => TypeRegistry::shopReview(),
                    'args' => ['orderId' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new ShopReviewService();
                        return $service->getMyReviewForOrder((int)$args['orderId'], (int)$context['user']['id']);
                    },
                ],

                // ── Caro (cờ caro) ─────────────────────────────────────
                'caroRoom' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => ['id' => Type::nonNull(Type::int())],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new CaroService();
                        return $service->getRoom((int) $context['user']['id'], (int) $args['id']);
                    },
                ],

                'caroRoomByCode' => [
                    'type' => TypeRegistry::caroRoom(),
                    'args' => ['code' => Type::nonNull(Type::string())],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new CaroService();
                        return $service->getRoomByCode((int) $context['user']['id'], (string) $args['code']);
                    },
                ],

                'caroPublicRooms' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::caroRoom()))),
                    'args' => ['limit' => ['type' => Type::int(), 'defaultValue' => 30]],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new CaroService();
                        return $service->listPublicRooms((int) $context['user']['id'], (int) $args['limit']);
                    },
                ],

                'caroMyActiveRooms' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::caroRoom()))),
                    'args' => ['limit' => ['type' => Type::int(), 'defaultValue' => 10]],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new CaroService();
                        return $service->listMyActive((int) $context['user']['id'], (int) $args['limit']);
                    },
                ],

                'caroMyHistory' => [
                    'type' => Type::nonNull(Type::listOf(Type::nonNull(TypeRegistry::caroRoom()))),
                    'args' => ['limit' => ['type' => Type::int(), 'defaultValue' => 10]],
                    'resolve' => function ($root, $args, $context) {
                        if (!$context['user']) throw new \GraphQL\Error\Error('Unauthorized');
                        $service = new CaroService();
                        return $service->listMyHistory((int) $context['user']['id'], (int) $args['limit']);
                    },
                ],

            ],
        ]);
    }
}
