<?php

namespace App\Services;

use Exception;

/**
 * Tra cứu lộ trình đơn hàng qua API GHN (Giao Hàng Nhanh).
 * Endpoint: POST {base}/v2/shipping-order/detail  (header Token + ShopId).
 * Cấu hình qua env: GHN_API_BASE, GHN_TOKEN, GHN_SHOP_ID.
 */
class GhnTrackingService
{
    // Map mã trạng thái GHN -> nhãn tiếng Việt.
    private const STATUS_LABELS = [
        'ready_to_pick'            => 'Chờ lấy hàng',
        'picking'                  => 'Đang lấy hàng',
        'cancel'                   => 'Đã huỷ',
        'money_collect_picking'    => 'Đang thu tiền khi lấy hàng',
        'picked'                   => 'Đã lấy hàng',
        'storing'                  => 'Đang lưu kho',
        'transporting'             => 'Đang trung chuyển',
        'sorting'                  => 'Đang phân loại',
        'delivering'               => 'Đang giao hàng',
        'money_collect_delivering' => 'Đang giao & thu tiền',
        'delivered'                => 'Đã giao thành công',
        'delivery_fail'            => 'Giao không thành công',
        'waiting_to_return'        => 'Chờ trả hàng',
        'return'                   => 'Đang trả hàng',
        'return_transporting'      => 'Đang trung chuyển trả',
        'return_sorting'           => 'Đang phân loại trả',
        'returning'                => 'Đang hoàn hàng',
        'return_fail'              => 'Hoàn hàng thất bại',
        'returned'                 => 'Đã hoàn hàng',
        'exception'                => 'Sự cố vận chuyển',
        'damage'                   => 'Hàng hư hỏng',
        'lost'                     => 'Thất lạc',
    ];

    /**
     * Trả mảng các bước lộ trình (mới nhất trước):
     * [ ['time' => ISO, 'status' => mã GHN, 'label' => nhãn VN], ... ]
     */
    public function track(string $orderCode): array
    {
        $base   = rtrim($_ENV['GHN_API_BASE'] ?? 'https://online-gateway.ghn.vn/shiip/public-api', '/');
        $token  = trim($_ENV['GHN_TOKEN'] ?? '');
        $shopId = trim($_ENV['GHN_SHOP_ID'] ?? '');

        if ($token === '') {
            throw new Exception('Chưa cấu hình GHN API (thiếu GHN_TOKEN trong .env)', 503);
        }

        $orderCode = trim($orderCode);
        if ($orderCode === '') {
            throw new Exception('Đơn hàng chưa có mã vận đơn', 400);
        }

        $headers = [
            'Content-Type: application/json',
            'Token: ' . $token,
        ];
        if ($shopId !== '') {
            $headers[] = 'ShopId: ' . $shopId;
        }

        $ch = curl_init($base . '/v2/shipping-order/detail');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['order_code' => $orderCode]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false) {
            throw new Exception('Không kết nối được tới GHN, thử lại sau', 502);
        }

        $json = json_decode($raw, true);
        $code = $json['code'] ?? 0;

        if ($code !== 200 || !isset($json['data'])) {
            $msg = $json['message'] ?? 'Tra cứu GHN thất bại';
            if (stripos($msg, 'not valid') !== false) {
                $msg = 'Token GHN không hợp lệ — kiểm tra GHN_TOKEN trong .env';
            } elseif (stripos($msg, 'not found') !== false || stripos($msg, 'không tồn tại') !== false) {
                $msg = 'Không tìm thấy đơn với mã vận đơn này trên GHN';
            }
            // Không nuốt lỗi: ghi log chi tiết kỹ thuật để debug.
            error_log(sprintf('[GhnTrackingService] order=%s HTTP %d resp=%s', $orderCode, $httpCode, substr((string)$raw, 0, 300)));
            throw new Exception($msg, ($httpCode >= 400 && $httpCode < 600) ? $httpCode : 502);
        }

        $data = $json['data'];
        $log  = $data['log'] ?? [];
        $steps = [];

        foreach ($log as $entry) {
            $status = (string)($entry['status'] ?? '');
            if ($status === '') {
                continue;
            }
            $steps[] = [
                'time'   => $entry['updated_date'] ?? ($entry['action_at'] ?? null),
                'status' => $status,
                'label'  => self::STATUS_LABELS[$status] ?? $status,
            ];
        }

        // Fallback: nếu không có log nhưng có trạng thái hiện tại.
        if (empty($steps) && !empty($data['status'])) {
            $status = (string)$data['status'];
            $steps[] = [
                'time'   => $data['updated_date'] ?? null,
                'status' => $status,
                'label'  => self::STATUS_LABELS[$status] ?? $status,
            ];
        }

        // GHN trả log tăng dần thời gian → đảo để mới nhất lên đầu.
        return array_reverse($steps);
    }
}
