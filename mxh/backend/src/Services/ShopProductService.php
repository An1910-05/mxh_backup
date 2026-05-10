<?php

namespace App\Services;

use App\Repositories\ShopProductRepository;
use App\Repositories\ShopCategoryRepository;
use Exception;

class ShopProductService
{
    private ShopProductRepository $productRepo;
    private ShopCategoryRepository $categoryRepo;

    public function __construct()
    {
        $this->productRepo = new ShopProductRepository();
        $this->categoryRepo = new ShopCategoryRepository();
    }

    public function getProducts(array $filters = [], int $limit = 20, int $page = 1): array
    {
        $offset = ($page - 1) * $limit;
        $products = $this->productRepo->findAll($filters, $limit, $offset);

        // Parse JSON fields
        foreach ($products as &$product) {
            $product['images'] = json_decode($product['images'] ?? '[]', true);
        }

        return $products;
    }

    public function getProductById(int $id, bool $incrementView = false): ?array
    {
        $product = $this->productRepo->findById($id);

        if (!$product) {
            return null;
        }

        // Increment view count if requested
        if ($incrementView) {
            $this->productRepo->incrementViewCount($id);
            $product['view_count']++;
        }

        // Parse JSON fields
        $product['images'] = json_decode($product['images'] ?? '[]', true);

        return $product;
    }

    public function createProduct(int $sellerId, array $data): array
    {
        // Validate category exists
        $category = $this->categoryRepo->findById($data['category_id']);
        if (!$category) {
            throw new Exception('Category not found', 404);
        }

        // Validate required fields
        if (empty($data['title']) || strlen($data['title']) > 255) {
            throw new Exception('Title is required and must be less than 255 characters', 400);
        }

        if (empty($data['description'])) {
            throw new Exception('Description is required', 400);
        }

        if (!isset($data['price']) || $data['price'] <= 0) {
            throw new Exception('Price must be greater than 0', 400);
        }

        if (!in_array($data['product_type'], ['physical', 'digital'])) {
            throw new Exception('Product type must be physical or digital', 400);
        }

        // Validate stock for physical products
        if ($data['product_type'] === 'physical') {
            if (!isset($data['stock_quantity']) || $data['stock_quantity'] < 0) {
                throw new Exception('Stock quantity is required for physical products', 400);
            }
        } else {
            // Digital products have unlimited stock
            $data['stock_quantity'] = null;
        }

        // Validate images
        if (empty($data['images']) || !is_array($data['images'])) {
            throw new Exception('At least one image is required', 400);
        }

        if (count($data['images']) > 5) {
            throw new Exception('Maximum 5 images allowed', 400);
        }

        $productData = [
            'seller_id' => $sellerId,
            'category_id' => $data['category_id'],
            'title' => $data['title'],
            'description' => $data['description'],
            'product_type' => $data['product_type'],
            'price' => $data['price'],
            'stock_quantity' => $data['stock_quantity'],
            'images' => $data['images'],
            'digital_file_url' => $data['digital_file_url'] ?? null,
            'status' => 'approved',
            'approved_at' => date('Y-m-d H:i:s'),
        ];

        $productId = $this->productRepo->create($productData);
        return $this->getProductById($productId);
    }

    public function updateProduct(int $productId, int $sellerId, array $data): array
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        // Only seller can update their own product
        if ($product['seller_id'] != $sellerId) {
            throw new Exception('You can only update your own products', 403);
        }

        // Cannot update approved/pending products
        if (in_array($product['status'], ['pending', 'approved'])) {
            throw new Exception('Cannot update product that is pending or approved', 400);
        }

        // Validate category if provided
        if (isset($data['category_id'])) {
            $category = $this->categoryRepo->findById($data['category_id']);
            if (!$category) {
                throw new Exception('Category not found', 404);
            }
        }

        // Validate title length
        if (isset($data['title']) && strlen($data['title']) > 255) {
            throw new Exception('Title must be less than 255 characters', 400);
        }

        // Validate price
        if (isset($data['price']) && $data['price'] <= 0) {
            throw new Exception('Price must be greater than 0', 400);
        }

        // Validate images count
        if (isset($data['images']) && count($data['images']) > 5) {
            throw new Exception('Maximum 5 images allowed', 400);
        }

        $this->productRepo->update($productId, $data);
        return $this->getProductById($productId);
    }

    public function deleteProduct(int $productId, int $sellerId): bool
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        // Only seller can delete their own product
        if ($product['seller_id'] != $sellerId) {
            throw new Exception('You can only delete your own products', 403);
        }

        // Cannot delete approved products (must archive instead)
        if ($product['status'] === 'approved') {
            throw new Exception('Cannot delete approved product. Archive it instead.', 400);
        }

        return $this->productRepo->delete($productId);
    }

    public function submitForApproval(int $productId, int $sellerId): array
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        // Only seller can submit their own product
        if ($product['seller_id'] != $sellerId) {
            throw new Exception('You can only submit your own products', 403);
        }

        // Can only submit draft or rejected products
        if (!in_array($product['status'], ['draft', 'rejected'])) {
            throw new Exception('Can only submit draft or rejected products', 400);
        }

        $this->productRepo->update($productId, ['status' => 'pending']);
        return $this->getProductById($productId);
    }

    public function approveProduct(int $productId, int $adminId): array
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        if ($product['status'] !== 'pending') {
            throw new Exception('Can only approve pending products', 400);
        }

        $this->productRepo->update($productId, [
            'status' => 'approved',
            'approved_at' => date('Y-m-d H:i:s'),
            'approved_by' => $adminId,
            'rejection_reason' => null
        ]);

        return $this->getProductById($productId);
    }

    public function rejectProduct(int $productId, int $adminId, string $reason): array
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        if ($product['status'] !== 'pending') {
            throw new Exception('Can only reject pending products', 400);
        }

        if (empty($reason)) {
            throw new Exception('Rejection reason is required', 400);
        }

        $this->productRepo->update($productId, [
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'approved_at' => null,
            'approved_by' => null
        ]);

        return $this->getProductById($productId);
    }

    public function archiveProduct(int $productId, int $sellerId): array
    {
        $product = $this->productRepo->findById($productId);

        if (!$product) {
            throw new Exception('Product not found', 404);
        }

        // Only seller can archive their own product
        if ($product['seller_id'] != $sellerId) {
            throw new Exception('You can only archive your own products', 403);
        }

        $this->productRepo->update($productId, ['status' => 'archived']);
        return $this->getProductById($productId);
    }
}
