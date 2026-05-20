<?php

namespace App\Controllers;

use App\Services\PaymentService;
use App\Services\MomoService;
use App\Middleware\AuthMiddleware;
use App\Helpers\Response;

class PaymentController
{
    private PaymentService $paymentService;
    private MomoService $momoService;

    public function __construct()
    {
        $this->paymentService = new PaymentService();
        $this->momoService = new MomoService();
    }

    public function createPayment(): void
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $amount = (int)($data['amount'] ?? 0);
        if ($amount < 10000) {
            Response::error('Số tiền nạp tối thiểu là 10,000 VND', 422);
            return;
        }

        $provider = strtolower((string)($data['provider'] ?? 'vnpay'));
        if (!in_array($provider, ['vnpay', 'momo'], true)) {
            Response::error('Phương thức thanh toán không hợp lệ', 422);
            return;
        }

        try {
            if ($provider === 'momo') {
                $result = $this->momoService->createPaymentUrl($user['id'], $amount);
            } else {
                $ipAddr = $_SERVER['HTTP_X_FORWARDED_FOR']
                    ?? $_SERVER['HTTP_X_REAL_IP']
                    ?? $_SERVER['REMOTE_ADDR']
                    ?? '127.0.0.1';
                $ipAddr = explode(',', $ipAddr)[0];
                $result = $this->paymentService->createPaymentUrl($user['id'], $amount, trim($ipAddr));
            }
            Response::success($result, 'Payment URL created');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    /**
     * VNPay IPN — server-to-server callback
     */
    public function ipn(): void
    {
        try {
            $result = $this->paymentService->verifyPayment($_GET);
            header('Content-Type: application/json');
            echo json_encode($result);
        } catch (\Throwable $e) {
            header('Content-Type: application/json');
            echo json_encode(['RspCode' => '99', 'Message' => 'Unknown error']);
        }
        exit;
    }

    /**
     * MoMo IPN — POST JSON server-to-server callback.
     */
    public function momoIpn(): void
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $result = $this->momoService->verifyPaymentIpn($data);
            header('Content-Type: application/json');
            echo json_encode($result);
        } catch (\Throwable $e) {
            header('Content-Type: application/json');
            echo json_encode(['resultCode' => 99, 'message' => 'Unknown error']);
        }
        exit;
    }

    /**
     * Verify payment result for frontend.
     * Dispatch by provider: query string contains either VNPay vnp_* params or MoMo orderId+resultCode.
     */
    public function verifyReturn(): void
    {
        try {
            // Detect provider from query params.
            $isMomo = isset($_GET['orderId']) && (isset($_GET['resultCode']) || isset($_GET['signature']) || (isset($_GET['provider']) && $_GET['provider'] === 'momo'));
            if ($isMomo) {
                $result = $this->momoService->getPaymentResult($_GET);
            } else {
                $result = $this->paymentService->getPaymentResult($_GET);
            }
            Response::success($result);
        } catch (\Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getBalance(): void
    {
        $user = AuthMiddleware::authenticate();
        $balance = $this->paymentService->getBalance($user['id']);
        Response::success(['balance' => $balance]);
    }

    public function getTransactions(): void
    {
        $user = AuthMiddleware::authenticate();
        $transactions = $this->paymentService->getTransactions($user['id']);
        Response::success(['transactions' => $transactions]);
    }
}
