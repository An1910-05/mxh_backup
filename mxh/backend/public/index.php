<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use App\Middleware\CorsMiddleware;
use App\Middleware\AuthMiddleware;
use App\Controllers\AuthController;
use App\Controllers\UploadController;
use App\Controllers\ChatController;
use App\Controllers\LinkPreviewController;
use App\Controllers\PaymentController;
use App\Controllers\AIController;
use App\Controllers\AdminController;
use App\Helpers\Response;
use GraphQL\GraphQL;
use GraphQL\Error\DebugFlag;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

CorsMiddleware::handle();

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

try {
    // REST Routes
    switch (true) {

        // Health check
        case $uri === '/health' && $method === 'GET':
            Response::success(['status' => 'ok', 'timestamp' => date('c')], 'Server is running');
            break;

        // Auth routes
        case $uri === '/auth/register' && $method === 'POST':
            (new AuthController())->register();
            break;

        case $uri === '/auth/login' && $method === 'POST':
            (new AuthController())->login();
            break;

        case $uri === '/auth/logout' && $method === 'POST':
            (new AuthController())->logout();
            break;

        case $uri === '/auth/me' && $method === 'GET':
            (new AuthController())->me();
            break;

        case $uri === '/auth/google' && $method === 'POST':
            (new AuthController())->googleLogin();
            break;

        case $uri === '/auth/forgot-password' && $method === 'POST':
            (new AuthController())->forgotPassword();
            break;

        case $uri === '/auth/reset-password' && $method === 'POST':
            (new AuthController())->resetPassword();
            break;

        case $uri === '/auth/settings' && $method === 'GET':
            (new AuthController())->getSettings();
            break;

        case $uri === '/auth/settings/password' && $method === 'POST':
            (new AuthController())->changePassword();
            break;

        case $uri === '/auth/settings/profile' && $method === 'POST':
            (new AuthController())->updateProfile();
            break;

        // Upload
        case $uri === '/upload' && $method === 'POST':
            (new UploadController())->uploadAvatar();
            break;

        case $uri === '/upload/cover' && $method === 'POST':
            (new UploadController())->uploadCover();
            break;

        case $uri === '/upload/media' && $method === 'POST':
            (new UploadController())->uploadPostMedia();
            break;

        // Chat REST routes
        case $uri === '/chat/conversations' && $method === 'GET':
            (new ChatController())->getConversations();
            break;

        case $uri === '/chat/conversation' && $method === 'POST':
            (new ChatController())->getOrCreateConversation();
            break;

        case $uri === '/chat/messages' && $method === 'GET':
            (new ChatController())->getMessages();
            break;

        case $uri === '/chat/messages/send' && $method === 'POST':
            (new ChatController())->sendMessage();
            break;

        case $uri === '/chat/messages/read' && $method === 'POST':
            (new ChatController())->markRead();
            break;

        case $uri === '/chat/messages/edit' && $method === 'POST':
            (new ChatController())->editMessage();
            break;

        case $uri === '/chat/messages/delete' && $method === 'POST':
            (new ChatController())->deleteMessage();
            break;

        case $uri === '/chat/messages/unsend' && $method === 'POST':
            (new ChatController())->unsendMessage();
            break;

        case $uri === '/chat/messages/hide' && $method === 'POST':
            (new ChatController())->hideMessage();
            break;

        case $uri === '/chat/messages/search' && $method === 'GET':
            (new ChatController())->searchMessages();
            break;

        case $uri === '/chat/read-receipt' && $method === 'GET':
            (new ChatController())->getReadReceipt();
            break;

        case $uri === '/chat/conversation/clear' && $method === 'POST':
            (new ChatController())->clearConversation();
            break;

        case $uri === '/chat/conversation/hide' && $method === 'POST':
            (new ChatController())->hideConversation();
            break;

        case $uri === '/chat/conversation/hide-all-for-me' && $method === 'POST':
            (new ChatController())->hideAllMessagesForMe();
            break;

        // Group chat (Phase 1 + 2)
        case $uri === '/chat/group/create' && $method === 'POST':
            (new ChatController())->createGroup();
            break;

        case $uri === '/chat/group/members/add' && $method === 'POST':
            (new ChatController())->addGroupMembers();
            break;

        case $uri === '/chat/group/members/remove' && $method === 'POST':
            (new ChatController())->removeGroupMember();
            break;

        case $uri === '/chat/group/info' && $method === 'POST':
            (new ChatController())->updateGroupInfo();
            break;

        case $uri === '/chat/group/leave' && $method === 'POST':
            (new ChatController())->leaveGroup();
            break;

        case $uri === '/chat/group/role' && $method === 'POST':
            (new ChatController())->changeGroupRole();
            break;

        case $uri === '/chat/group/dissolve' && $method === 'POST':
            (new ChatController())->dissolveGroup();
            break;

        case $uri === '/chat/group/members' && $method === 'GET':
            (new ChatController())->getGroupMembers();
            break;

        case $uri === '/chat/group/read-status' && $method === 'GET':
            (new ChatController())->getGroupReadStatus();
            break;

        // Payment
        case $uri === '/payment/create' && $method === 'POST':
            (new PaymentController())->createPayment();
            break;

        case $uri === '/payment/ipn' && $method === 'GET':
            (new PaymentController())->ipn();
            break;

        case $uri === '/payment/momo/ipn' && $method === 'POST':
            (new PaymentController())->momoIpn();
            break;

        case $uri === '/payment/verify' && $method === 'GET':
            (new PaymentController())->verifyReturn();
            break;

        case $uri === '/payment/balance' && $method === 'GET':
            (new PaymentController())->getBalance();
            break;

        case $uri === '/payment/transactions' && $method === 'GET':
            (new PaymentController())->getTransactions();
            break;

        // Link preview
        case $uri === '/link-preview' && $method === 'GET':
            (new LinkPreviewController())->getPreview();
            break;

        // AI chat (Gemini proxy)
        case $uri === '/ai/chat' && $method === 'POST':
            (new AIController())->chat();
            break;

        // ── Admin routes (require role=admin) ────────────────────────────────
        case $uri === '/admin/stats' && $method === 'GET':
            (new AdminController())->getStats();
            break;

        case $uri === '/admin/users' && $method === 'GET':
            (new AdminController())->getUsers();
            break;

        case $uri === '/admin/users/block' && $method === 'POST':
            (new AdminController())->blockUser();
            break;

        case $uri === '/admin/users/delete' && $method === 'POST':
            (new AdminController())->deleteUser();
            break;

        case $uri === '/admin/users/role' && $method === 'POST':
            (new AdminController())->setRole();
            break;

        case $uri === '/admin/posts' && $method === 'GET':
            (new AdminController())->getPosts();
            break;

        case $uri === '/admin/posts/delete' && $method === 'POST':
            (new AdminController())->deletePost();
            break;

        case $uri === '/admin/transactions' && $method === 'GET':
            (new AdminController())->getTransactions();
            break;

        // GraphQL endpoint
        case $uri === '/graphql' && $method === 'POST':
            handleGraphQL();
            break;

        default:
            Response::error('Not found', 404);
    }
} catch (\Throwable $e) {
    Response::error('Internal server error: ' . $e->getMessage(), 500);
}

function handleGraphQL(): void
{
    $user = AuthMiddleware::optionalAuth();

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!$input) {
        Response::error('Invalid JSON body', 400);
    }

    $query = $input['query'] ?? '';
    $variables = $input['variables'] ?? null;
    $operationName = $input['operationName'] ?? null;

    $schema = \App\GraphQL\Schema::build();

    $context = [
        'user' => $user,
    ];

    try {
        $result = GraphQL::executeQuery(
            $schema,
            $query,
            null,
            $context,
            $variables,
            $operationName
        );

        $output = $result->toArray(DebugFlag::INCLUDE_DEBUG_MESSAGE);

        header('Content-Type: application/json');
        echo json_encode($output, JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        Response::error('GraphQL execution error: ' . $e->getMessage(), 500);
    }
}
