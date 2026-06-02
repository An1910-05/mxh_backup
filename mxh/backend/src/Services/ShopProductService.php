<?php

namespace App\Services;

use App\Repositories\ShopProductRepository;
use App\Repositories\ShopCategoryRepository;
use App\Repositories\ShopProductVariantRepository;
use Exception;

class ShopProductService
{
    private ShopProductRepository $productRepo;
    private ShopCategoryRepository $categoryRepo;
    private ShopProductVariantRepository $variantRepo;

    public function __construct()
    {
        $this->productRepo = new ShopProductRepository();
        $this->categoryRepo = new ShopCategoryRepository();
        $this->variantRepo = new ShopProductVariantRepository();
    }

    /**
     * Validate + normalise an incoming variant list (single-tier "Phân loại").
     * Returns clean rows ready for the repository; throws on invalid input.
     */
    private function normalizeVariants(array $variants, string $productType): array
    {
        if (count($variants) > 20) {
            throw new Exception('Tối đa 20 phân loại cho mỗi sản phẩm', 400);
        }
        $clean = [];
        foreach (array_values($variants) as $i => $v) {
            $name = trim($v['name'] ?? '');
            if ($name === '' || mb_strlen($name) > 120) {
                throw new Exception('Tên phân loại không hợp lệ (bắt buộc, tối đa 120 ký tự)', 400);
            }
            $price = (int) ($v['price'] ?? 0);
            if ($price <= 0) {
                throw new Exception("Giá phân loại \"{$name}\" phải lớn hơn 0", 400);
            }
            $stock = null;
            if ($productType === 'physical') {
                $stock = (int) ($v['stock_quantity'] ?? 0);
                if ($stock < 0) {
                    throw new Exception("Tồn kho phân loại \"{$name}\" không hợp lệ", 400);
                }
            }
            $clean[] = [
                'name'           => $name,
                'price'          => $price,
                'stock_quantity' => $stock,
                'image'          => !empty($v['image']) ? $v['image'] : null,
                'display_order'  => $i,
            ];
        }
        return $clean;
    }

    public function getProducts(array $filters = [], int $limit = 20, int $page = 1): array
    {
        $offset = ($page - 1) * $limit;
        $products = $this->productRepo->findAll($filters, $limit, $offset);

        // Parse JSON fields + attach variants
        foreach ($products as &$product) {
            $product['images'] = json_decode($product['images'] ?? '[]', true);
            $product['variants'] = $this->variantRepo->findByProduct((int) $product['id']);
        }
        unset($product);

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

        // Parse JSON fields + attach variants
        $product['images'] = json_decode($product['images'] ?? '[]', true);
        $product['variants'] = $this->variantRepo->findByProduct((int) $product['id']);

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

        if (!in_array($data['product_type'], ['physical', 'digital'])) {
            throw new Exception('Product type must be physical or digital', 400);
        }

        // Variants (optional single-tier "Phân loại"). When present, base price/stock
        // are derived from them (min price / sum stock); per-product price/stock
        // validation is skipped.
        $variants = (isset($data['variants']) && is_array($data['variants'])) ? $data['variants'] : [];
        $hasVariants = count($variants) > 0;

        if ($hasVariants) {
            $variants = $this->normalizeVariants($variants, $data['product_type']);
            $data['price'] = min(array_map(fn($v) => $v['price'], $variants));
            $data['stock_quantity'] = $data['product_type'] === 'physical'
                ? array_sum(array_map(fn($v) => (int) $v['stock_quantity'], $variants))
                : null;
        } else {
            if (!isset($data['price']) || $data['price'] <= 0) {
                throw new Exception('Price must be greater than 0', 400);
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
        if ($hasVariants) {
            $this->variantRepo->bulkInsert($productId, $variants);
        }
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

        // Seller may edit their product (incl. approved ones) — status is kept as-is.
        // Archived products are read-only.
        if ($product['status'] === 'archived') {
            throw new Exception('Cannot edit an archived product', 400);
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

        // Handle variants if provided (single-tier). product_type cannot change on edit,
        // so derive base price/stock from the existing product's type.
        if (array_key_exists('variants', $data)) {
            $rawVariants = is_array($data['variants']) ? $data['variants'] : [];
            unset($data['variants']);
            if (count($rawVariants) > 0) {
                $clean = $this->normalizeVariants($rawVariants, $product['product_type']);
                $this->variantRepo->replaceForProduct($productId, $clean);
                $data['price'] = min(array_map(fn($v) => $v['price'], $clean));
                $data['stock_quantity'] = $product['product_type'] === 'physical'
                    ? array_sum(array_map(fn($v) => (int) $v['stock_quantity'], $clean))
                    : null;
            } else {
                // Seller removed all variants -> back to a simple product.
                $this->variantRepo->deleteByProduct($productId);
            }
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
