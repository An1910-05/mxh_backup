<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;

class ShopSellerApplicationType extends ObjectType
{
    public function __construct()
    {
        parent::__construct([
            'name' => 'ShopSellerApplication',
            'fields' => fn() => [
                'id' => Type::nonNull(Type::int()),
                'userId' => [
                    'type' => Type::nonNull(Type::int()),
                    'resolve' => fn($row) => (int)$row['user_id'],
                ],
                'storeName' => [
                    'type' => Type::nonNull(Type::string()),
                    'resolve' => fn($row) => $row['store_name'],
                ],
                'intro' => Type::nonNull(Type::string()),
                'phone' => Type::nonNull(Type::string()),
                'address' => Type::nonNull(Type::string()),
                'status' => Type::nonNull(Type::string()),
                'rejectionReason' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['rejection_reason'] ?? null,
                ],
                'reviewedBy' => [
                    'type' => Type::int(),
                    'resolve' => fn($row) => isset($row['reviewed_by']) ? (int)$row['reviewed_by'] : null,
                ],
                'reviewedAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['reviewed_at'] ?? null,
                ],
                'createdAt' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['created_at'] ?? null,
                ],
                'applicantUsername' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['applicant_username'] ?? null,
                ],
                'applicantEmail' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['applicant_email'] ?? null,
                ],
                'reviewerUsername' => [
                    'type' => Type::string(),
                    'resolve' => fn($row) => $row['reviewer_username'] ?? null,
                ],
            ],
        ]);
    }
}
