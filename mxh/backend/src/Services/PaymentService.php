<?php

namespace App\Services;

use App\Config\Database;
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
        if (empty($_ENV['VNP_TMN_CODE']) || empty($_ENV['VNP_HASH_SECRET'])) {
            throw new \RuntimeException('VNPay credentials (VNP_TMN_CODE, VNP_HASH_SECRET) chưa được cấu hình trong .env');
        }
        $this->tmnCode = $_ENV['VNP_TMN_CODE'];
        $this->hashSecret = $_ENV['VNP_HASH_SECRET'];
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

        // Save pending transaction before redirecting to VNPay.
        $this->txnRepo->create($userId, $txnRef, $amount, $description, 'vnpay');

        $frontendUrl = rtrim(explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173')[0], '/');

        // Mock mode cho dev local khi VNPay sandbox chưa duyệt URL.
        // Bật bằng PAYMENT_MOCK=1 trong .env. Bỏ qua VNPay, redirect thẳng về
        // /payment/result với params giả lập callback success.
        if (($_ENV['PAYMENT_MOCK'] ?? '0') === '1') {
            $mockParams = http_build_query([
                'mock' => '1',
                'vnp_TxnRef' => $txnRef,
                'vnp_Amount' => $amount * 100,
                'vnp_ResponseCode' => '00',
                'vnp_TransactionNo' => 'MOCK' . time(),
                'vnp_BankCode' => 'MOCK_BANK',
            ]);
            return [
                'payment_url' => $frontendUrl . '/payment/result?' . $mockParams,
                'txn_ref' => $txnRef,
                'mock' => true,
            ];
        }

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
            if ($i === 1) {
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
     * Verify VNPay IPN data
     */
    public function verifyPayment(array $vnpData): array
    {
        $payment = $this->parsePaymentPayload($vnpData);
        if ($payment === null) {
            return ['RspCode' => '97', 'Message' => 'Invalid signature'];
        }

        $result = $this->finalizePayment($payment);

        return [
            'RspCode' => $result['rsp_code'],
            'Message' => $result['rsp_message'],
        ];
    }

    /**
     * Get payment result for frontend.
     * On local environments this also finalizes pending transactions when the
     * browser returns from VNPay and IPN has not reached localhost.
     */
    public function getPaymentResult(array $vnpData): array
    {
        $payment = $this->parsePaymentPayload($vnpData);
        if ($payment === null) {
            return ['valid' => false, 'message' => 'Chữ ký không hợp lệ'];
        }

        $result = $this->finalizePayment($payment);
        if (!$result['valid']) {
            return [
                'valid' => false,
                'message' => $result['message'],
                'response_code' => $result['response_code'],
                'txn_ref' => $result['txn_ref'],
                'amount' => $result['amount'],
                'status' => $result['status'],
            ];
        }

        return [
            'valid' => true,
            'success' => $result['success'],
            'response_code' => $result['response_code'],
            'txn_ref' => $result['txn_ref'],
            'amount' => $result['amount'],
            'message' => $result['message'],
            'credited' => $result['credited'],
            'status' => $result['status'],
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

    private function parsePaymentPayload(array $vnpData): ?array
    {
        // Mock mode: bỏ qua signature check, chấp nhận params như VNPay trả về thật.
        // Chỉ kích hoạt khi PAYMENT_MOCK=1 (cấu hình backend), tránh bypass ở prod.
        if (
            ($_ENV['PAYMENT_MOCK'] ?? '0') === '1'
            && isset($vnpData['mock']) && $vnpData['mock'] === '1'
        ) {
            return [
                'txn_ref' => (string)($vnpData['vnp_TxnRef'] ?? ''),
                'amount' => ((int)($vnpData['vnp_Amount'] ?? 0)) / 100,
                'response_code' => (string)($vnpData['vnp_ResponseCode'] ?? '99'),
                'transaction_no' => (string)($vnpData['vnp_TransactionNo'] ?? ''),
                'bank_code' => (string)($vnpData['vnp_BankCode'] ?? ''),
            ];
        }

        $secureHash = $vnpData['vnp_SecureHash'] ?? '';
        unset($vnpData['vnp_SecureHash'], $vnpData['vnp_SecureHashType']);

        ksort($vnpData);
        $hashData = '';
        $i = 0;
        foreach ($vnpData as $key => $value) {
            if (!str_starts_with($key, 'vnp_')) {
                continue;
            }

            if ($i === 1) {
                $hashData .= '&' . urlencode($key) . '=' . urlencode($value);
            } else {
                $hashData .= urlencode($key) . '=' . urlencode($value);
                $i = 1;
            }
        }

        $checkHash = hash_hmac('sha512', $hashData, $this->hashSecret);
        if (!$secureHash || !hash_equals($checkHash, $secureHash)) {
            return null;
        }

        return [
            'txn_ref' => (string)($vnpData['vnp_TxnRef'] ?? ''),
            'amount' => ((int)($vnpData['vnp_Amount'] ?? 0)) / 100,
            'response_code' => (string)($vnpData['vnp_ResponseCode'] ?? '99'),
            'transaction_no' => (string)($vnpData['vnp_TransactionNo'] ?? ''),
            'bank_code' => (string)($vnpData['vnp_BankCode'] ?? ''),
        ];
    }

    private function finalizePayment(array $payment): array
    {
        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $txn = $this->txnRepo->findByTxnRefForUpdate($payment['txn_ref']);
            if (!$txn) {
                $db->rollBack();
                return [
                    'valid' => false,
                    'success' => false,
                    'rsp_code' => '01',
                    'rsp_message' => 'Order not found',
                    'response_code' => $payment['response_code'],
                    'txn_ref' => $payment['txn_ref'],
                    'amount' => (int)$payment['amount'],
                    'message' => 'Không tìm thấy giao dịch.',
                    'credited' => false,
                    'status' => 'missing',
                ];
            }

            if ((int)$txn['amount'] !== (int)$payment['amount']) {
                $db->rollBack();
                return [
                    'valid' => false,
                    'success' => false,
                    'rsp_code' => '04',
                    'rsp_message' => 'Invalid amount',
                    'response_code' => $payment['response_code'],
                    'txn_ref' => (string)$txn['txn_ref'],
                    'amount' => (int)$txn['amount'],
                    'message' => 'Số tiền giao dịch không khớp.',
                    'credited' => false,
                    'status' => (string)$txn['status'],
                ];
            }

            $credited = false;
            $alreadyProcessed = $txn['status'] !== 'pending';

            if (!$alreadyProcessed) {
                if ($payment['response_code'] === '00') {
                    $this->txnRepo->updateStatus(
                        $payment['txn_ref'],
                        'success',
                        $payment['response_code'],
                        $payment['transaction_no'],
                        $payment['bank_code']
                    );
                    $this->txnRepo->addBalance((int)$txn['user_id'], (int)$txn['amount']);
                    $txn['status'] = 'success';
                    $txn['vnp_response_code'] = $payment['response_code'];
                    $credited = true;
                } else {
                    $this->txnRepo->updateStatus(
                        $payment['txn_ref'],
                        'failed',
                        $payment['response_code'],
                        $payment['transaction_no'],
                        $payment['bank_code']
                    );
                    $txn['status'] = 'failed';
                    $txn['vnp_response_code'] = $payment['response_code'];
                }
            }

            $db->commit();

            $responseCode = (string)($txn['vnp_response_code'] ?? $payment['response_code']);
            $success = $txn['status'] === 'success';

            return [
                'valid' => true,
                'success' => $success,
                'rsp_code' => $alreadyProcessed ? '02' : '00',
                'rsp_message' => $alreadyProcessed ? 'Order already confirmed' : 'Confirm Success',
                'response_code' => $responseCode,
                'txn_ref' => (string)$txn['txn_ref'],
                'amount' => (int)$txn['amount'],
                'message' => $success ? 'Thanh toán thành công.' : 'Thanh toán thất bại.',
                'credited' => $credited,
                'status' => (string)$txn['status'],
            ];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }
}
