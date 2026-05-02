<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use App\GraphQL\TypeRegistry;

class ShopOrderType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopOrder',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'orderNumber' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['order_number']
                ],
                'buyerId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['buyer_id']
                ],
                'buyer' => [
                    'type' => TypeRegistry::user(),
                    'resolve' => fn($root) => [
                        'id' => $root['buyer_id'],
                        'username' => $root['buyer_username'],
                        'avatar' => $root['buyer_avatar']
                    ]
                ],
                'sellerId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['seller_id']
                ],
                'seller' => [
                    'type' => TypeRegistry::user(),
                    'resolve' => fn($root) => [
                        'id' => $root['seller_id'],
                        'username' => $root['seller_username'],
                        'avatar' => $root['seller_avatar']
                    ]
                ],
                'productId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => $root['product_id']
                ],
                'productSnapshot' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => json_encode($root['product_snapshot'])
                ],
                'quantity' => Type::nonNull(Type::int()),
                'unitPrice' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['unit_price']
                ],
                'totalPrice' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['total_price']
                ],
                'commissionRate' => [
                    'type' => Type::nonNull(Type::float()),
                    'resolve' => fn($root) => (float) $root['commission_rate']
                ],
                'commissionAmount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['commission_amount']
                ],
                'sellerAmount' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($root) => (int) $root['seller_amount']
                ],
                'status' => Type::nonNull(Type::string()),
                'paymentStatus' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['payment_status']
                ],
                'shippingAddress' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['shipping_address'] ? json_encode($root['shipping_address']) : null
                ],
                'trackingNumber' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['tracking_number']
                ],
                'buyerNotes' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['buyer_notes']
                ],
                'sellerNotes' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['seller_notes']
                ],
                'cancellationReason' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['cancellation_reason']
                ],
                'cancelledBy' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['cancelled_by']
                ],
                'createdAt' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['created_at']
                ],
                'updatedAt' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($root) => $root['updated_at']
                ],
                'confirmedAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['confirmed_at']
                ],
                'shippedAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['shipped_at']
                ],
                'deliveredAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['delivered_at']
                ],
                'completedAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['completed_at']
                ],
                'cancelledAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($root) => $root['cancelled_at']
                ]
            ]
        ]);
    }
}
