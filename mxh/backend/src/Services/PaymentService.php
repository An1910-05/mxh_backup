<?php

namespace App\Services;

use App\Repositories\TransactionRepository;

class PaymentService
{
    private TransactionRepository $txnRepo;
    private string $tmnCode;
    private string $hashSecret;
    private string $vnpUrl;

    public function __construct()
    {
        $this->txnRepo = new TransactionRepository();
        $this->tmnCode = $_ENV['VNP_TMN_CODE'] ?? '5UQ9JN3J';
        $this->hashSecret = $_ENV['VNP_HASH_SECRET'] ?? '4ADPX1KAMS0N2GKFA834HHVT0A6DELTO';
        $this->vnpUrl = $_ENV['VNP_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    }

    /**
     * Create VNPay payment URL
     */
    public function createPaymentUrl(int $userId, int $amount, string $ipAddr): array
    {
        if ($amount < 10000) {
            throw new \RuntimeException('Số tiền nạp tối thiểu là 10,000 VND', 400);
        }

        $txnRef = $userId . '_' . time() . '_' . mt_rand(1000, 9999);
        $description = 'Nap tien iPock - ' . number_format($amount) . ' VND';

        // Save pending transaction
        $this->txnRepo->create($userId, $txnRef, $amount, $description);

        $frontendUrl = rtrim(explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173')[0], '/');
        $backendUrl = rtrim($_ENV['APP_URL'] ?? 'http://localhost:8000', '/');

        $tz = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $now = new \DateTime('now', $tz);
        $expire = (clone $now)->modify('+15 minutes');

        $inputData = [
            'vnp_Version' => '2.1.0',
            'vnp_Command' => 'pay',
            'vnp_TmnCode' => $this->tmnCode,
            'vnp_Amount' => $amount * 100,
            'vnp_CreateDate' => $now->format('YmdHis'),
            'vnp_CurrCode' => 'VND',
            'vnp_IpAddr' => $ipAddr,
            'vnp_Locale' => 'vn',
            'vnp_OrderInfo' => $description,
            'vnp_OrderType' => 'topup',
            'vnp_ReturnUrl' => $frontendUrl . '/payment/result',
            'vnp_TxnRef' => $txnRef,
            'vnp_ExpireDate' => $expire->format('YmdHis'),
        ];

        ksort($inputData);
        $hashData = '';
        $query = '';
        $i = 0;
        foreach ($inputData as $key => $value) {
            if ($i == 1) {
                $hashData .= '&' . urlencode($key) . '=' . urlencode($value);
                $query .= '&' . urlencode($key) . '=' . urlencode($value);
            } else {
                $hashData .= urlencode($key) . '=' . urlencode($value);
                $query .= urlencode($key) . '=' . urlencode($value);
                $i = 1;
            }
        }

        $secureHash = hash_hmac('sha512', $hashData, $this->hashSecret);
        $paymentUrl = $this->vnpUrl . '?' . $query . '&vnp_SecureHash=' . $secureHash;

        return [
            'payment_url' => $paymentUrl,
            'txn_ref' => $txnRef,
        ];
    }

    /**
     * Verify VNPay return/IPN data
     */
    public function verifyPayment(array $vnpData): array
    {
        $secureHash = $vnpData['vnp_SecureHash'] ?? '';
        unset($vnpData['vnp_SecureHash'], $vnpData['vnp_SecureHashType']);

        ksort($vnpData);
        $hashData = '';
        $i = 0;
        foreach ($vnpData as $key => $value) {
            if (str_starts_with($key, 'vnp_')) {
                if ($i == 1) {
                    $hashData .= '&' . urlencode($key) . '=' . urlencode($value);
                } else {
                    $hashData .= urlencode($key) . '=' . urlencode($value);
                    $i = 1;
                }
            }
        }

        $checkHash = hash_hmac('sha512', $hashData, $this->hashSecret);

        if (!hash_equals($checkHash, $secureHash)) {
            return ['RspCode' => '97', 'Message' => 'Invalid signature'];
        }

        $txnRef = $vnpData['vnp_TxnRef'] ?? '';
        $vnpAmount = ((int)($vnpData['vnp_Amount'] ?? 0)) / 100;
        $responseCode = $vnpData['vnp_ResponseCode'] ?? '99';
        $transactionNo = $vnpData['vnp_TransactionNo'] ?? '';
        $bankCode = $vnpData['vnp_BankCode'] ?? '';

        $txn = $this->txnRepo->findByTxnRef($txnRef);
        if (!$txn) {
            return ['RspCode' => '01', 'Message' => 'Order not found'];
        }

        if ((int)$txn['amount'] !== (int)$vnpAmount) {
            return ['RspCode' => '04', 'Message' => 'Invalid amount'];
        }

        if ($txn['status'] !== 'pending') {
            return ['RspCode' => '02', 'Message' => 'Order already confirmed'];
        }

        if ($responseCode === '00') {
            $this->txnRepo->updateStatus($txnRef, 'success', $responseCode, $transactionNo, $bankCode);
            $this->txnRepo->addBalance($txn['user_id'], (int)$txn['amount']);
        } else {
            $this->txnRepo->updateStatus($txnRef, 'failed', $responseCode, $transactionNo, $bankCode);
        }

        return ['RspCode' => '00', 'Message' => 'Confirm Success'];
    }

    /**
     * Get payment result for frontend
     */
    public function getPaymentResult(array $vnpData): array
    {
        $secureHash = $vnpData['vnp_SecureHash'] ?? '';
        unset($vnpData['vnp_SecureHash'], $vnpData['vnp_SecureHashType']);

        ksort($vnpData);
        $hashData = '';
        $i = 0;
        foreach ($vnpData as $key => $value) {
            if (str_starts_with($key, 'vnp_')) {
                if ($i == 1) {
                    $hashData .= '&' . urlencode($key) . '=' . urlencode($value);
                } else {
                    $hashData .= urlencode($key) . '=' . urlencode($value);
                    $i = 1;
                }
            }
        }

        $checkHash = hash_hmac('sha512', $hashData, $this->hashSecret);

        if (!hash_equals($checkHash, $secureHash)) {
            return ['valid' => false, 'message' => 'Chữ ký không hợp lệ'];
        }

        $responseCode = $vnpData['vnp_ResponseCode'] ?? '99';
        $txnRef = $vnpData['vnp_TxnRef'] ?? '';
        $amount = ((int)($vnpData['vnp_Amount'] ?? 0)) / 100;

        return [
            'valid' => true,
            'success' => $responseCode === '00',
            'response_code' => $responseCode,
            'txn_ref' => $txnRef,
            'amount' => $amount,
            'message' => $responseCode === '00' ? 'Thanh toán thành công' : 'Thanh toán thất bại',
        ];
    }

    public function getBalance(int $userId): int
    {
        return $this->txnRepo->getBalance($userId);
    }

    public function getTransactions(int $userId, int $limit = 20): array
    {
        return $this->txnRepo->getByUserId($userId, $limit);
    }
}
