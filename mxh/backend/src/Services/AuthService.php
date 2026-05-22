<?php

namespace App\Services;

use App\Helpers\JWTHelper;
use App\Repositories\ProfileRepository;
use App\Repositories\UserRepository;

class AuthService
{
    private UserRepository $userRepo;
    private ProfileRepository $profileRepo;

    public function __construct()
    {
        $this->userRepo = new UserRepository();
        $this->profileRepo = new ProfileRepository();
    }

    public function register(string $username, string $email, string $password, ?string $birthday = null, ?string $gender = null): array
    {
        if ($this->userRepo->findByEmail($email)) {
            throw new \RuntimeException('Email already exists', 409);
        }

        if ($this->userRepo->findByUsername($username)) {
            throw new \RuntimeException('Username already exists', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $userId = $this->userRepo->create($username, $email, $passwordHash, $birthday ?: null, $gender ?: null);

        $this->profileRepo->create($userId);

        $user = $this->userRepo->findById($userId);
        $token = JWTHelper::encode(['user_id' => $userId]);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    public function login(string $email, string $password): array
    {
        $user = $this->userRepo->findByEmail($email);

        if (!$user) {
            throw new \RuntimeException('Invalid credentials', 401);
        }

        if (!password_verify($password, $user['password_hash'])) {
            throw new \RuntimeException('Invalid credentials', 401);
        }

        if (!empty($user['is_blocked'])) {
            throw new \RuntimeException('account_banned', 403);
        }

        $this->userRepo->updateLoginDevice($user['id'], self::detectDevice());

        $token = JWTHelper::encode(['user_id' => $user['id']]);

        unset($user['password_hash']);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    private static function detectDevice(): string
    {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return preg_match('/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i', $ua)
            ? 'mobile'
            : 'web';
    }

    public function googleLogin(string $idToken, ?string $birthday = null, ?string $gender = null): array
    {
        $payload = $this->verifyGoogleToken($idToken);
        if (!$payload) {
            throw new \RuntimeException('Token Google không hợp lệ', 401);
        }

        $googleId = $payload['sub'];
        $email = $payload['email'] ?? null;
        $name = $payload['name'] ?? $payload['email'] ?? 'user';

        if (!$email) {
            throw new \RuntimeException('Không lấy được email từ Google', 400);
        }

        $user = $this->userRepo->findByGoogleId($googleId);
        if ($user) {
            $this->userRepo->updateLoginDevice($user['id'], self::detectDevice());
            $token = JWTHelper::encode(['user_id' => $user['id']]);
            unset($user['password_hash']);
            return ['user' => $user, 'token' => $token];
        }

        $user = $this->userRepo->findByEmail($email);
        if ($user) {
            $this->userRepo->linkGoogleId($user['id'], $googleId);
            $this->userRepo->updateLoginDevice($user['id'], self::detectDevice());
            $token = JWTHelper::encode(['user_id' => $user['id']]);
            unset($user['password_hash']);
            return ['user' => $user, 'token' => $token];
        }

        if (!$birthday || !$gender) {
            return ['needs_profile' => true, 'email' => $email];
        }

        $username = preg_replace('/[^a-zA-Z0-9_]/', '', $name);
        if (strlen($username) < 3) {
            $username = 'user' . substr(md5($googleId), 0, 8);
        }

        $base = $username;
        $i = 1;
        while ($this->userRepo->findByUsername($username)) {
            $username = $base . $i;
            $i++;
        }

        $userId = $this->userRepo->createFromGoogle($username, $email, $googleId, $birthday, $gender);
        $this->profileRepo->create($userId);

        $user = $this->userRepo->findById($userId);
        $token = JWTHelper::encode(['user_id' => $userId]);

        return ['user' => $user, 'token' => $token];
    }

    public function forgotPassword(string $email): array
    {
        $user = $this->userRepo->findByEmail($email);
        if (!$user) {
            return ['message' => 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.'];
        }

        $token = bin2hex(random_bytes(32));
        $expires = (new \DateTime('+1 hour'))->format('Y-m-d H:i:s');

        $this->userRepo->setResetToken($user['id'], $token, $expires);

        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:5173', ',');
        $frontendUrl = rtrim(explode(',', $frontendUrl)[0], '/');
        $resetLink = $frontendUrl . '/reset-password?token=' . $token;

        $mailService = new MailService();
        if ($mailService->isConfigured()) {
            $mailService->sendPasswordResetEmail(
                $user['email'],
                $user['username'] ?? null,
                $resetLink
            );

            return [
                'message' => 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
            ];
        }

        // Chỉ trả reset_link trong môi trường development (không phải production)
        $isDev = strtolower($_ENV['APP_ENV'] ?? 'development') !== 'production';
        if ($isDev) {
            return [
                'message' => 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
                'reset_link' => $resetLink,
                'delivery' => 'debug',
            ];
        }

        return ['message' => 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.'];
    }

    public function resetPassword(string $token, string $newPassword): array
    {
        $user = $this->userRepo->findByResetToken($token);
        if (!$user) {
            throw new \RuntimeException('Token không hợp lệ hoặc đã hết hạn', 400);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->userRepo->updatePassword($user['id'], $passwordHash);

        return ['message' => 'Mật khẩu đã được đặt lại thành công.'];
    }

    public function changePassword(int $userId, ?string $currentPassword, string $newPassword): array
    {
        $user = $this->userRepo->findByIdFull($userId);
        if (!$user) {
            throw new \RuntimeException('Không tìm thấy người dùng', 404);
        }

        if ($user['password_hash'] !== '' && $user['password_hash'] !== null) {
            if (!$currentPassword) {
                throw new \RuntimeException('Vui lòng nhập mật khẩu hiện tại', 400);
            }
            if (!password_verify($currentPassword, $user['password_hash'])) {
                throw new \RuntimeException('Mật khẩu hiện tại không đúng', 400);
            }
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $this->userRepo->updatePassword($userId, $hash);

        return ['message' => 'Mật khẩu đã được cập nhật thành công.'];
    }

    public function updateProfile(int $userId, array $data): array
    {
        $user = $this->userRepo->findById($userId);
        if (!$user) {
            throw new \RuntimeException('Không tìm thấy người dùng', 404);
        }

        $this->userRepo->updateProfile($userId, $data);
        $updated = $this->userRepo->findById($userId);

        return ['user' => $updated];
    }

    public function getFullUser(int $userId): ?array
    {
        $user = $this->userRepo->findByIdFull($userId);
        if (!$user) {
            return null;
        }

        $hasPassword = $user['password_hash'] !== '' && $user['password_hash'] !== null;
        $hasGoogle = !empty($user['google_id']);

        unset($user['password_hash'], $user['google_id'], $user['reset_token'], $user['reset_token_expires']);
        $user['has_password'] = $hasPassword;
        $user['has_google'] = $hasGoogle;

        return $user;
    }

    public function getCurrentUser(int $userId): ?array
    {
        return $this->userRepo->findById($userId);
    }

    private function verifyGoogleToken(string $idToken): ?array
    {
        $clientId = $_ENV['GOOGLE_CLIENT_ID'] ?? null;
        if (!$clientId) {
            throw new \RuntimeException('GOOGLE_CLIENT_ID chưa được cấu hình', 500);
        }

        $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
        $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $response = @file_get_contents($url, false, $ctx);

        if ($response === false) {
            return null;
        }

        $data = json_decode($response, true);
        if (!$data || !isset($data['sub'])) {
            return null;
        }

        // Bắt buộc kiểm tra audience để tránh token từ app khác
        if (($data['aud'] ?? '') !== $clientId) {
            return null;
        }

        // Kiểm tra token chưa hết hạn
        if (($data['exp'] ?? 0) < time()) {
            return null;
        }

        // Yêu cầu email đã được xác minh
        if (!($data['email_verified'] ?? false)) {
            return null;
        }

        return $data;
    }
}
