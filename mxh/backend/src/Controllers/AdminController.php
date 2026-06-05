<?php

namespace App\Controllers;

use App\Middleware\AdminMiddleware;
use App\Config\Database;
use App\Helpers\Response;

class AdminController
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
        AdminMiddleware::authenticate();
    }

    // ── Stats ──────────────────────────────────────────────────────────────────

    public function getStats(): void
    {
        $stats = [];

        // Total users
        $stats['total_users'] = (int)$this->db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $stats['blocked_users'] = (int)$this->db->query("SELECT COUNT(*) FROM users WHERE is_blocked = 1")->fetchColumn();
        $stats['admin_users'] = (int)$this->db->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();

        // New users this week
        $stats['new_users_week'] = (int)$this->db->query(
            "SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )->fetchColumn();

        // Total posts (hard delete model — no is_deleted column)
        $stats['total_posts'] = (int)$this->db->query("SELECT COUNT(*) FROM posts")->fetchColumn();
        $stats['new_posts_week'] = (int)$this->db->query(
            "SELECT COUNT(*) FROM posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )->fetchColumn();

        // Total transactions & revenue
        $stats['total_transactions'] = (int)$this->db->query("SELECT COUNT(*) FROM transactions")->fetchColumn();
        $stats['total_revenue'] = (float)$this->db->query(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'success'"
        )->fetchColumn();

        // Users joined per day (last 7 days)
        $stmt = $this->db->query(
            "SELECT DATE(created_at) as date, COUNT(*) as count
             FROM users
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date ASC"
        );
        $stats['users_chart'] = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        Response::success($stats);
    }

    // ── Users ──────────────────────────────────────────────────────────────────

    public function getUsers(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        $search = trim($_GET['search'] ?? '');
        $filter = $_GET['filter'] ?? 'all'; // all | blocked | admin

        $where = "u.email NOT LIKE 'deleted\\_%'";
        $params = [];

        if ($search !== '') {
            $where .= ' AND (u.username LIKE :s OR u.email LIKE :s2)';
            $params[':s'] = "%{$search}%";
            $params[':s2'] = "%{$search}%";
        }

        if ($filter === 'blocked') {
            $where .= ' AND u.is_blocked = 1';
        } elseif ($filter === 'admin') {
            $where .= " AND u.role = 'admin'";
        }

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE {$where}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $this->db->prepare(
            "SELECT u.id, u.username, u.email, p.avatar, u.role, u.is_blocked, u.created_at
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE {$where}
             ORDER BY u.created_at DESC
             LIMIT {$limit} OFFSET {$offset}"
        );
        $stmt->execute($params);
        $users = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        Response::success([
            'users' => $users,
            'total' => $total,
            'page' => $page,
            'pages' => (int)ceil($total / $limit),
        ]);
    }

    public function blockUser(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = (int)($data['user_id'] ?? 0);
        $block = (bool)($data['block'] ?? true);

        if ($userId === 0) {
            Response::error('user_id required', 400);
        }

        // Prevent blocking other admins
        $target = $this->db->prepare("SELECT role FROM users WHERE id = ?");
        $target->execute([$userId]);
        $row = $target->fetch(\PDO::FETCH_ASSOC);

        if (!$row) Response::error('User not found', 404);
        if ($row['role'] === 'admin') Response::error('Cannot block another admin', 403);

        $stmt = $this->db->prepare("UPDATE users SET is_blocked = ? WHERE id = ?");
        $stmt->execute([$block ? 1 : 0, $userId]);

        Response::success(['user_id' => $userId, 'is_blocked' => $block]);
    }

    public function deleteUser(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = (int)($data['user_id'] ?? 0);

        if ($userId === 0) Response::error('user_id required', 400);

        $target = $this->db->prepare("SELECT role FROM users WHERE id = ?");
        $target->execute([$userId]);
        $row = $target->fetch(\PDO::FETCH_ASSOC);

        if (!$row) Response::error('User not found', 404);
        if ($row['role'] === 'admin') Response::error('Cannot delete an admin account', 403);

        // Soft delete: just block permanently and mark deleted
        $stmt = $this->db->prepare("UPDATE users SET is_blocked = 1, email = CONCAT('deleted_', id, '_', email) WHERE id = ?");
        $stmt->execute([$userId]);

        Response::success(['deleted' => true, 'user_id' => $userId]);
    }

    public function setRole(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = (int)($data['user_id'] ?? 0);
        $role = $data['role'] ?? 'user';

        if ($userId === 0) Response::error('user_id required', 400);
        if (!in_array($role, ['user', 'admin'])) Response::error('Invalid role', 400);

        $stmt = $this->db->prepare("UPDATE users SET role = ? WHERE id = ?");
        $stmt->execute([$role, $userId]);

        Response::success(['user_id' => $userId, 'role' => $role]);
    }

    // ── Posts ─────────────────────────────────────────────────────────────────

    public function getPosts(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        $search = trim($_GET['search'] ?? '');

        $where = '1=1';
        $params = [];

        if ($search !== '') {
            $where .= ' AND (p.content LIKE :s OR u.username LIKE :s2)';
            $params[':s'] = "%{$search}%";
            $params[':s2'] = "%{$search}%";
        }

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN profiles pr ON pr.user_id = u.id WHERE {$where}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $this->db->prepare(
            "SELECT p.id, p.content, p.media_url, p.created_at,
                    u.id as user_id, u.username, pr.avatar,
                    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
             FROM posts p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN profiles pr ON pr.user_id = u.id
             WHERE {$where}
             ORDER BY p.created_at DESC
             LIMIT {$limit} OFFSET {$offset}"
        );
        $stmt->execute($params);
        $posts = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        Response::success([
            'posts' => $posts,
            'total' => $total,
            'page' => $page,
            'pages' => (int)ceil($total / $limit),
        ]);
    }

    public function deletePost(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $postId = (int)($data['post_id'] ?? 0);

        if ($postId === 0) Response::error('post_id required', 400);

        $stmt = $this->db->prepare("DELETE FROM posts WHERE id = ?");
        $stmt->execute([$postId]);

        Response::success(['deleted' => true, 'post_id' => $postId]);
    }

    // ── Wallet Adjustment ─────────────────────────────────────────────────────

    public function adjustBalance(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = (int)($data['user_id'] ?? 0);
        $amount = (int)($data['amount'] ?? 0);
        $description = trim($data['description'] ?? '');

        if ($userId === 0) { Response::error('user_id required', 400); return; }
        if ($amount === 0) { Response::error('Số tiền không được bằng 0', 400); return; }
        if ($description === '') $description = $amount > 0 ? 'Admin cộng tiền' : 'Admin trừ tiền';

        $stmt = $this->db->prepare("SELECT id, username, balance FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$user) { Response::error('User not found', 404); return; }

        if ($amount < 0 && ($user['balance'] + $amount) < 0) {
            Response::error('Số dư không đủ để trừ', 400);
            return;
        }

        $this->db->prepare("UPDATE users SET balance = balance + ? WHERE id = ?")->execute([$amount, $userId]);

        $txnRef = 'adm_' . $userId . '_' . time() . '_' . rand(1000, 9999);
        $this->db->prepare(
            "INSERT INTO transactions (user_id, txn_ref, amount, description, status, provider) VALUES (?, ?, ?, ?, 'success', 'admin')"
        )->execute([$userId, $txnRef, $amount, $description]);

        $balStmt = $this->db->prepare("SELECT balance FROM users WHERE id = ?");
        $balStmt->execute([$userId]);
        $newBalance = (int)$balStmt->fetchColumn();

        Response::success([
            'user_id' => $userId,
            'username' => $user['username'],
            'adjustment' => $amount,
            'new_balance' => $newBalance,
        ]);
    }

    // ── Transactions ──────────────────────────────────────────────────────────

    public function getTransactions(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        $search = trim($_GET['search'] ?? '');

        $where = '1=1';
        $params = [];

        if ($search !== '') {
            $where .= ' AND (u.username LIKE :s OR t.txn_ref LIKE :s2)';
            $params[':s'] = "%{$search}%";
            $params[':s2'] = "%{$search}%";
        }

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM transactions t JOIN users u ON u.id = t.user_id WHERE {$where}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $this->db->prepare(
            "SELECT t.id, t.amount, t.status, t.txn_ref, t.description, t.bank_code, t.created_at,
                    u.id as user_id, u.username, p.avatar
             FROM transactions t
             JOIN users u ON u.id = t.user_id
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE {$where}
             ORDER BY t.created_at DESC
             LIMIT {$limit} OFFSET {$offset}"
        );
        $stmt->execute($params);
        $transactions = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        Response::success([
            'transactions' => $transactions,
            'total' => $total,
            'page' => $page,
            'pages' => (int)ceil($total / $limit),
        ]);
    }
}
