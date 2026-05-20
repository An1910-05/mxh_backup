<?php

namespace App\Services;

use App\Config\Database;
use App\Repositories\TransactionRepository;

/**
 * MoMo payment service. Supports MoMo One-Time Payment (AIO) v2 API.
 * Falls back to mock redirect when PAYMENT_MOCK=1 or MoMo credentials missing,
 * mirroring PaymentService (VNPay) so dev local vẫn nạp được tiền.
 */
class MomoService
{
    private TransactionRepository $txnRepo;
    private string $partnerCode;
    private string $accessKey;
    private string $secretKey;
    private string $endpoint;
    private bool $hasCredentials;

    public function __construct()
    {
        $this->txnRepo = new TransactionRepository();
        $this->partnerCode = $_ENV['MOMO_PARTNER_CODE'] ?? '';
        $this->accessKey = $_ENV['MOMO_ACCESS_KEY'] ?? '';
        $this->secretKey = $_ENV['MOMO_SECRET_KEY'] ?? '';
        $this->endpoint = $_ENV['MOMO_ENDPOINT'] ?? 'https://test-payment.momo.vn/v2/gateway/api/create';
        $this->hasCredentials = $this->partnerCode !== '' && $this->accessKey !== '' && $this->secretKey !== '';
    }

    public function createPaymentUrl(int $userId, int $amount): array
    {
        if ($amount < 10000) {
            throw new \RuntimeException('Số tiền nạp tối thiểu là 10,000 VND', 400);
        }

        $txnRef = 'momo_' . $userId . '_' . time() . '_' . mt_rand(1000, 9999);
        $description = 'Nap tien iPock - ' . number_format($amount) . ' VND';

        $this->txnRepo->create($userId, $txnRef, $amount, $description, 'momo');

        $frontendUrl = rtrim(explode(',', $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173')[0], '/');
        $returnUrl = $frontendUrl . '/payment/result';

        // Mock mode for dev or when credentials missing: redirect straight to result page.
        if (($_ENV['PAYMENT_MOCK'] ?? '0') === '1' || !$this->hasCredentials) {
            $mockParams = http_build_query([
                'mock' => '1',
                'provider' => 'momo',
                'orderId' => $txnRef,
                'amount' => $amount,
                'resultCode' => 0,
                'transId' => 'MOMOMOCK' . time(),
                'message' => 'Success (mock)',
            ]);
            return [
                'payment_url' => $returnUrl . '?' . $mockParams,
                'txn_ref' => $txnRef,
                'provider' => 'momo',
                'mock' => true,
            ];
        }

        $requestId = $txnRef . '-' . mt_rand(1000, 9999);
        $backendUrl = rtrim($_ENV['BACKEND_URL'] ?? 'http://localhost:8000', '/');
        $ipnUrl = $backendUrl . '/payment/momo/ipn';

        $rawHash = sprintf(
            'accessKey=%s&amount=%s&extraData=%s&ipnUrl=%s&orderId=%s&orderInfo=%s&partnerCode=%s&redirectUrl=%s&requestId=%s&requestType=%s',
            $this->accessKey,
            $amount,
            '',
            $ipnUrl,
            $txnRef,
            $description,
            $this->partnerCode,
            $returnUrl,
            $requestId,
            'captureWallet'
        );
        $signature = hash_hmac('sha256', $rawHash, $this->secretKey);

        $payload = [
            'partnerCode' => $this->partnerCode,
            'accessKey' => $this->accessKey,
            'requestId' => $requestId,
            'amount' => (string)$amount,
            'orderId' => $txnRef,
            'orderInfo' => $description,
            'redirectUrl' => $returnUrl,
            'ipnUrl' => $ipnUrl,
            'extraData' => '',
            'requestType' => 'captureWallet',
            'signature' => $signature,
            'lang' => 'vi',
        ];

        $ch = curl_init($this->endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $resp = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            throw new \RuntimeException('Không kết nối được tới MoMo: ' . $err, 502);
        }

        $data = json_decode($resp, true) ?? [];
        if (!isset($data['payUrl']) || ($data['resultCode'] ?? -1) !== 0) {
            $msg = $data['message'] ?? 'Lỗi không xác định từ MoMo';
            throw new \RuntimeException('MoMo từ chối tạo giao dịch: ' . $msg, 502);
        }

        return [
            'payment_url' => $data['payUrl'],
            'txn_ref' => $txnRef,
            'provider' => 'momo',
        ];
    }

    /**
     * MoMo IPN callback (POST JSON, server-to-server).
     */
    public function verifyPaymentIpn(array $data): array
    {
        $parsed = $this->parsePaymentPayload($data);
        if ($parsed === null) {
            return ['resultCode' => 99, 'message' => 'Invalid signature'];
        }

        $result = $this->finalizePayment($parsed);
        return [
            'resultCode' => $result['result_code'],
            'message' => $result['rsp_message'],
        ];
    }

    /**
     * Browser redirect callback — finalize transaction if IPN didn't reach localhost.
     */
    public function getPaymentResult(array $data): array
    {
        $parsed = $this->parsePaymentPayload($data);
        if ($parsed === null) {
            return ['valid' => false, 'message' => 'Chữ ký không hợp lệ'];
        }

        $result = $this->finalizePayment($parsed);
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

    private function parsePaymentPayload(array $data): ?array
    {
        // Mock mode: skip signature check.
        if (
            (($_ENV['PAYMENT_MOCK'] ?? '0') === '1' || !$this->hasCredentials)
            && isset($data['mock']) && $data['mock'] === '1'
        ) {
            return [
                'txn_ref' => (string)($data['orderId'] ?? ''),
                'amount' => (int)($data['amount'] ?? 0),
                'response_code' => (string)($data['resultCode'] ?? '99'),
                'trans_id' => (string)($data['transId'] ?? ''),
                'request_id' => (string)($data['requestId'] ?? ''),
            ];
        }

        $signature = (string)($data['signature'] ?? '');
        if ($signature === '') {
            return null;
        }

        $rawHash = sprintf(
            'accessKey=%s&amount=%s&extraData=%s&message=%s&orderId=%s&orderInfo=%s&orderType=%s&partnerCode=%s&payType=%s&requestId=%s&responseTime=%s&resultCode=%s&transId=%s',
            $this->accessKey,
            (string)($data['amount'] ?? ''),
            (string)($data['extraData'] ?? ''),
            (string)($data['message'] ?? ''),
            (string)($data['orderId'] ?? ''),
            (string)($data['orderInfo'] ?? ''),
            (string)($data['orderType'] ?? ''),
            $this->partnerCode,
            (string)($data['payType'] ?? ''),
            (string)($data['requestId'] ?? ''),
            (string)($data['responseTime'] ?? ''),
            (string)($data['resultCode'] ?? ''),
            (string)($data['transId'] ?? '')
        );
        $expected = hash_hmac('sha256', $rawHash, $this->secretKey);
        if (!hash_equals($expected, $signature)) {
            return null;
        }

        return [
            'txn_ref' => (string)($data['orderId'] ?? ''),
            'amount' => (int)($data['amount'] ?? 0),
            'response_code' => (string)($data['resultCode'] ?? '99'),
            'trans_id' => (string)($data['transId'] ?? ''),
            'request_id' => (string)($data['requestId'] ?? ''),
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
                    'result_code' => 1,
                    'rsp_message' => 'Order not found',
                    'response_code' => $payment['response_code'],
                    'txn_ref' => $payment['txn_ref'],
                    'amount' => $payment['amount'],
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
                    'result_code' => 4,
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
                if ((string)$payment['response_code'] === '0') {
                    $this->txnRepo->updateMomoStatus(
                        $payment['txn_ref'],
                        'success',
                        $payment['response_code'],
                        $payment['trans_id'],
                        $payment['request_id']
                    );
                    $this->txnRepo->addBalance((int)$txn['user_id'], (int)$txn['amount']);
                    $txn['status'] = 'success';
                    $txn['vnp_response_code'] = $payment['response_code'];
                    $credited = true;
                } else {
                    $this->txnRepo->updateMomoStatus(
                        $payment['txn_ref'],
                        'failed',
                        $payment['response_code'],
                        $payment['trans_id'],
                        $payment['request_id']
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
                'result_code' => $alreadyProcessed ? 9000 : 0,
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
