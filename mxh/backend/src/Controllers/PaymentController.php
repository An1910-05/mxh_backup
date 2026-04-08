<?php

namespace App\Controllers;

use App\Services\PaymentService;
use App\Middleware\AuthMiddleware;
use App\Helpers\Response;

class PaymentController
{
    private PaymentService $paymentService;

    public function __construct()
    {
        $this->paymentService = new PaymentService();
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

        $ipAddr = $_SERVER['HTTP_X_FORWARDED_FOR']
            ?? $_SERVER['HTTP_X_REAL_IP']
            ?? $_SERVER['REMOTE_ADDR']
            ?? '127.0.0.1';
        // Take first IP if multiple
        $ipAddr = explode(',', $ipAddr)[0];

        try {
            $result = $this->paymentService->createPaymentUrl($user['id'], $amount, trim($ipAddr));
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
     * Verify payment result for frontend — also processes payment (IPN may not fire on localhost)
     */
    public function verifyReturn(): void
    {
        try {
            // Process payment: update DB + balance (idempotent — safe to call multiple times)
            $this->paymentService->verifyPayment($_GET);
            // Return frontend-friendly result
            $result = $this->paymentService->getPaymentResult($_GET);
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
