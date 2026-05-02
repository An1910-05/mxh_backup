<?php

namespace App\Services;

use App\Repositories\ShopOrderRepository;
use App\Repositories\ShopProductRepository;
use App\Repositories\ShopEscrowRepository;
use App\Repositories\UserRepository;
use App\Config\Database;
use Exception;
use PDO;

class ShopOrderService
{
    private ShopOrderRepository $orderRepo;
    private ShopProductRepository $productRepo;
    private ShopEscrowRepository $escrowRepo;
    private UserRepository $userRepo;
    private PDO $db;

    public function __construct()
    {
        $this->orderRepo = new ShopOrderRepository();
        $this->productRepo = new ShopProductRepository();
        $this->escrowRepo = new ShopEscrowRepository();
        $this->userRepo = new UserRepository();
        $this->db = Database::getConnection();
    }

    public function getOrders(array $filters = [], int $limit = 20, int $page = 1): array
    {
        $offset = ($page - 1) * $limit;
        $orders = $this->orderRepo->findAll($filters, $limit, $offset);

        // Parse JSON fields
        foreach ($orders as &$order) {
            $order['product_snapshot'] = json_decode($order['product_snapshot'] ?? '{}', true);
            $order['shipping_address'] = json_decode($order['shipping_address'] ?? 'null', true);
            $order['product_images'] = json_decode($order['product_images'] ?? '[]', true);
        }

        return $orders;
    }

    public function getOrderById(int $id): ?array
    {
        $order = $this->orderRepo->findById($id);

        if (!$order) {
            return null;
        }

        // Parse JSON fields
        $order['product_snapshot'] = json_decode($order['product_snapshot'] ?? '{}', true);
        $order['shipping_address'] = json_decode($order['shipping_address'] ?? 'null', true);
        $order['product_images'] = json_decode($order['product_images'] ?? '[]', true);

        return $order;
    }

    public function createOrder(int $buyerId, array $data): array
    {
        // Validate product exists and is available
        $product = $this->productRepo->findById($data['product_id']);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        if ($product['status'] !== 'approved') {
            throw new Exception('Product is not available for purchase', 400);
        }

        // Cannot buy own product
        if ($product['seller_id'] == $buyerId) {
            throw new Exception('You cannot buy your own product', 400);
        }

        // Validate quantity
        $quantity = $data['quantity'] ?? 1;
        if ($quantity < 1) {
            throw new Exception('Quantity must be at least 1', 400);
        }

        // Check stock for physical products
        if ($product['product_type'] === 'physical') {
            if ($product['stock_quantity'] !== null && $product['stock_quantity'] < $quantity) {
                throw new Exception('Insufficient stock', 400);
            }

            // Validate shipping address
            if (empty($data['shipping_address'])) {
                throw new Exception('Shipping address is required for physical products', 400);
            }
        }

        // Calculate prices
        $unitPrice = (int) $product['price'];
        $totalPrice = $unitPrice * $quantity;
        $commissionRate = (float) ($_ENV['SHOP_COMMISSION_RATE'] ?? 5.0);
        $commissionAmount = (int) ($totalPrice * ($commissionRate / 100));
        $sellerAmount = $totalPrice - $commissionAmount;

        // Check buyer balance
        $buyer = $this->userRepo->findById($buyerId);
        if ($buyer['balance'] < $totalPrice) {
            throw new Exception('Insufficient balance', 400);
        }

        // Start transaction
        $this->db->beginTransaction();

        try {
            // Generate order number
            $orderNumber = $this->orderRepo->generateOrderNumber();

            // Create product snapshot
            $productSnapshot = [
                'id' => $product['id'],
                'title' => $product['title'],
                'price' => $product['price'],
                'images' => json_decode($product['images'] ?? '[]', true),
                'productType' => $product['product_type'],
                'categoryName' => $product['category_name'],
                'sellerName' => $product['seller_username']
            ];

            // Create order
            $orderData = [
                'order_number' => $orderNumber,
                'buyer_id' => $buyerId,
                'seller_id' => $product['seller_id'],
                'product_id' => $product['id'],
                'product_snapshot' => $productSnapshot,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'commission_rate' => $commissionRate,
                'commission_amount' => $commissionAmount,
                'seller_amount' => $sellerAmount,
                'status' => 'pending',
                'payment_status' => 'pending',
                'shipping_address' => $data['shipping_address'] ?? null,
                'buyer_notes' => $data['buyer_notes'] ?? null
            ];

            $orderId = $this->orderRepo->create($orderData);

            // Deduct buyer balance
            $this->userRepo->updateBalance($buyerId, -$totalPrice);

            // Create escrow transaction
            $escrowData = [
                'order_id' => $orderId,
                'buyer_id' => $buyerId,
                'seller_id' => $product['seller_id'],
                'amount' => $totalPrice,
                'status' => 'held',
                'notes' => "Escrow for order {$orderNumber}"
            ];
            $escrowId = $this->escrowRepo->create($escrowData);

            // Update order with escrow ID
            $this->orderRepo->update($orderId, [
                'escrow_transaction_id' => $escrowId,
                'payment_status' => 'held'
            ]);

            // Decrement stock for physical products
            if ($product['product_type'] === 'physical' && $product['stock_quantity'] !== null) {
                $this->productRepo->decrementStock($product['id'], $quantity);
            }

            $this->db->commit();

            return $this->getOrderById($orderId);

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function confirmOrder(int $orderId, int $sellerId): array
    {
        $order = $this->orderRepo->findById($orderId);

        if (!$order) {
            throw new Exception('Order not found', 404);
        }

        // Only seller can confirm
        if ($order['seller_id'] != $sellerId) {
            throw new Exception('Only seller can confirm order', 403);
        }

        if ($order['status'] !== 'pending') {
            throw new Exception('Can only confirm pending orders', 400);
        }

        $updateData = [
            'status' => 'confirmed',
            'confirmed_at' => date('Y-m-d H:i:s')
        ];

        // Auto-deliver digital products
        $productSnapshot = json_decode($order['product_snapshot'], true);
        if ($productSnapshot['productType'] === 'digital') {
            $updateData['status'] = 'delivered';
            $updateData['delivered_at'] = date('Y-m-d H:i:s');
        }

        $this->orderRepo->update($orderId, $updateData);

        return $this->getOrderById($orderId);
    }

    public function shipOrder(int $orderId, int $sellerId, ?string $trackingNumber = null): array
    {
        $order = $this->orderRepo->findById($orderId);

        if (!$order) {
            throw new Exception('Order not found', 404);
        }

        // Only seller can ship
        if ($order['seller_id'] != $sellerId) {
            throw new Exception('Only seller can ship order', 403);
        }

        if ($order['status'] !== 'confirmed') {
            throw new Exception('Can only ship confirmed orders', 400);
        }

        $this->orderRepo->update($orderId, [
            'status' => 'shipping',
            'tracking_number' => $trackingNumber,
            'shipped_at' => date('Y-m-d H:i:s')
        ]);

        return $this->getOrderById($orderId);
    }

    public function confirmDelivery(int $orderId, int $buyerId): array
    {
        $order = $this->orderRepo->findById($orderId);

        if (!$order) {
            throw new Exception('Order not found', 404);
        }

        // Only buyer can confirm delivery
        if ($order['buyer_id'] != $buyerId) {
            throw new Exception('Only buyer can confirm delivery', 403);
        }

        if (!in_array($order['status'], ['shipping', 'delivered'])) {
            throw new Exception('Can only confirm delivery for shipping/delivered orders', 400);
        }

        // Start transaction for escrow release
        $this->db->beginTransaction();

        try {
            // Update order status
            $this->orderRepo->update($orderId, [
                'status' => 'completed',
                'payment_status' => 'released',
                'completed_at' => date('Y-m-d H:i:s')
            ]);

            // Release escrow to seller
            if ($order['escrow_transaction_id']) {
                $this->escrowRepo->updateStatus(
                    $order['escrow_transaction_id'],
                    'released',
                    "Released for completed order {$order['order_number']}"
                );

                // Add seller amount to seller balance
                $this->userRepo->updateBalance($order['seller_id'], (int) $order['seller_amount']);
            }

            // Increment product sold count
            $this->productRepo->incrementSoldCount($order['product_id'], (int) $order['quantity']);

            $this->db->commit();

            return $this->getOrderById($orderId);

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function cancelOrder(int $orderId, int $userId, string $reason, string $cancelledBy): array
    {
        $order = $this->orderRepo->findById($orderId);

        if (!$order) {
            throw new Exception('Order not found', 404);
        }

        // Validate cancellation permissions
        if ($cancelledBy === 'buyer' && $order['buyer_id'] != $userId) {
            throw new Exception('Only buyer can cancel as buyer', 403);
        }

        if ($cancelledBy === 'seller' && $order['seller_id'] != $userId) {
            throw new Exception('Only seller can cancel as seller', 403);
        }

        // Validate cancellation rules
        if ($cancelledBy === 'buyer' && !in_array($order['status'], ['pending', 'confirmed'])) {
            throw new Exception('Buyer can only cancel pending or confirmed orders', 400);
        }

        if ($cancelledBy === 'seller' && $order['status'] !== 'pending') {
            throw new Exception('Seller can only cancel pending orders', 400);
        }

        if ($order['status'] === 'completed') {
            throw new Exception('Cannot cancel completed orders', 400);
        }

        if (empty($reason)) {
            throw new Exception('Cancellation reason is required', 400);
        }

        // Start transaction for refund
        $this->db->beginTransaction();

        try {
            // Update order status
            $this->orderRepo->update($orderId, [
                'status' => 'cancelled',
                'payment_status' => 'refunded',
                'cancellation_reason' => $reason,
                'cancelled_by' => $cancelledBy,
                'cancelled_at' => date('Y-m-d H:i:s')
            ]);

            // Refund escrow to buyer
            if ($order['escrow_transaction_id']) {
                $this->escrowRepo->updateStatus(
                    $order['escrow_transaction_id'],
                    'refunded',
                    "Refunded for cancelled order {$order['order_number']}"
                );

                // Refund buyer balance
                $this->userRepo->updateBalance($order['buyer_id'], (int) $order['total_price']);
            }

            // Restore stock for physical products
            $productSnapshot = json_decode($order['product_snapshot'], true);
            if ($productSnapshot['productType'] === 'physical') {
                $this->productRepo->incrementStock($order['product_id'], (int) $order['quantity']);
            }

            $this->db->commit();

            return $this->getOrderById($orderId);

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
