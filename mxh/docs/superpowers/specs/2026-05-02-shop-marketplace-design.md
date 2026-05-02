# Shop/Marketplace Feature - Design Specification

**Date:** 2026-05-02  
**Author:** AI Assistant  
**Status:** Draft for Review  
**Target:** Phase 1 MVP - Core Marketplace

---

## 1. Executive Summary

This document specifies the design for a Shop/Marketplace feature within the MXH social network platform. The feature allows users to buy and sell both physical and digital products, with escrow payment protection, voucher support, and comprehensive admin management.

**Key Design Principle:** API-first architecture to enable future React Native mobile app development without backend changes.

---

## 2. Requirements Summary

### Confirmed Requirements:
- **Product Types:** Support both physical products (with shipping) and digital products (instant delivery)
- **Payment Model:** Escrow system (hold funds until buyer confirms receipt)
- **Voucher System:** Both sellers and admins can create vouchers
- **Order Tracking:** Detailed 5-6 status workflow
- **Commission:** Fixed percentage fee on each transaction
- **Categories:** Fixed category list managed by admin
- **Reviews:** Rating (1-5 stars) + text review after order completion
- **Chat Integration:** Use existing chat system for buyer-seller communication
- **Mobile Future:** Design for React Native compatibility

### Phase 1 Scope (MVP):
- Product listing and management
- Product search and filtering
- Order placement with escrow payment
- Order management (buyer and seller views)
- Admin product approval
- Basic admin dashboard

### Phase 2 (Future):
- Voucher system
- Review and rating system
- Advanced shipping tracking

### Phase 3 (Future):
- Analytics dashboard for sellers
- Revenue reports for admin
- Export functionality

---

## 3. Architecture Overview

### 3.1 Three-Tier Architecture

```
┌─────────────────────────────────────────┐
│   PRESENTATION LAYER                    │
│   - Web: React 18 (current)            │
│   - Mobile: React Native (future)      │
└─────────────────────────────────────────┘
                ↓ HTTP/GraphQL
┌─────────────────────────────────────────┐
│   API LAYER (Backend PHP 8.1+)         │
│   - GraphQL: queries + mutations       │
│   - REST: file upload, callbacks       │
│   - Services: business logic           │
│   - Repositories: data access          │
└─────────────────────────────────────────┘
                ↓ PDO
┌─────────────────────────────────────────┐
│   DATA LAYER (MySQL 8.0)               │
│   - Products, Orders, Categories, etc  │
└─────────────────────────────────────────┘
```

### 3.2 Mobile-Ready Design Principles

1. **Stateless Backend:** All authentication via JWT, no server-side sessions
2. **Consistent API Responses:** Same JSON structure for web and mobile
3. **Reusable Business Logic:** Service layer independent of presentation
4. **Image Optimization:** Multiple sizes for different screen densities
5. **Pagination:** All list endpoints support limit/offset for mobile performance

---

## 4. Database Schema

### 4.1 New Tables

#### `shop_categories`
```sql
CREATE TABLE shop_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(255),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### `shop_products`
```sql
CREATE TABLE shop_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    product_type ENUM('physical', 'digital') NOT NULL DEFAULT 'physical',
    price INT NOT NULL COMMENT 'Price in smallest currency unit',
    stock_quantity INT DEFAULT NULL COMMENT 'NULL = unlimited for digital',
    images JSON COMMENT 'Array of image URLs',
    digital_file_url VARCHAR(500) DEFAULT NULL COMMENT 'For digital products',
    status ENUM('draft', 'pending', 'approved', 'rejected', 'sold_out', 'archived') NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    view_count INT DEFAULT 0,
    sold_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id),
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_seller (seller_id),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC),
    FULLTEXT idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### `shop_orders`
```sql
CREATE TABLE shop_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    product_id INT NOT NULL,
    product_snapshot JSON NOT NULL COMMENT 'Product details at time of purchase',
    quantity INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL,
    total_price INT NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL COMMENT 'Platform commission %',
    commission_amount INT NOT NULL,
    seller_amount INT NOT NULL COMMENT 'Amount seller receives',
    status ENUM('pending', 'confirmed', 'shipping', 'delivered', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    payment_status ENUM('pending', 'held', 'released', 'refunded') NOT NULL DEFAULT 'pending',
    escrow_transaction_id INT NULL COMMENT 'Reference to escrow transaction',
    shipping_address JSON COMMENT 'For physical products',
    tracking_number VARCHAR(100),
    buyer_notes TEXT,
    seller_notes TEXT,
    cancellation_reason TEXT,
    cancelled_by ENUM('buyer', 'seller', 'admin') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    shipped_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES shop_products(id),
    INDEX idx_order_number (order_number),
    INDEX idx_buyer (buyer_id),
    INDEX idx_seller (seller_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### `shop_escrow_transactions`
```sql
CREATE TABLE shop_escrow_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    amount INT NOT NULL,
    status ENUM('held', 'released', 'refunded') NOT NULL DEFAULT 'held',
    held_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL,
    refunded_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.2 Default Categories

Initial categories to be seeded:
- Điện tử (Electronics)
- Thời trang (Fashion)
- Đồ gia dụng (Home & Living)
- Sách & Văn phòng phẩm (Books & Stationery)
- Thể thao & Du lịch (Sports & Travel)
- Sức khỏe & Làm đẹp (Health & Beauty)
- Digital Products (Ebooks, Courses, Templates)
- Khác (Other)

---

## 5. API Design

### 5.1 GraphQL Schema

#### Types

```graphql
type ShopCategory {
  id: Int!
  name: String!
  slug: String!
  description: String
  icon: String
  displayOrder: Int!
  isActive: Boolean!
  productCount: Int!
}

type ShopProduct {
  id: Int!
  sellerId: Int!
  seller: User!
  categoryId: Int!
  category: ShopCategory!
  title: String!
  description: String!
  productType: String!
  price: Int!
  stockQuantity: Int
  images: [String!]!
  digitalFileUrl: String
  status: String!
  rejectionReason: String
  viewCount: Int!
  soldCount: Int!
  createdAt: String!
  updatedAt: String!
  approvedAt: String
  approvedBy: Int
}

type ShopOrder {
  id: Int!
  orderNumber: String!
  buyerId: Int!
  buyer: User!
  sellerId: Int!
  seller: User!
  productId: Int!
  product: ShopProduct!
  productSnapshot: String!
  quantity: Int!
  unitPrice: Int!
  totalPrice: Int!
  commissionRate: Float!
  commissionAmount: Int!
  sellerAmount: Int!
  status: String!
  paymentStatus: String!
  shippingAddress: String
  trackingNumber: String
  buyerNotes: String
  sellerNotes: String
  cancellationReason: String
  cancelledBy: String
  createdAt: String!
  updatedAt: String!
  confirmedAt: String
  shippedAt: String
  deliveredAt: String
  completedAt: String
  cancelledAt: String
}
```

#### Queries

```graphql
type Query {
  # Categories
  shopCategories: [ShopCategory!]!
  shopCategory(id: Int!): ShopCategory
  
  # Products
  shopProducts(
    categoryId: Int
    sellerId: Int
    status: String
    productType: String
    search: String
    limit: Int
    page: Int
  ): [ShopProduct!]!
  
  shopProduct(id: Int!): ShopProduct
  
  myShopProducts(
    status: String
    limit: Int
    page: Int
  ): [ShopProduct!]!
  
  # Orders
  myPurchases(
    status: String
    limit: Int
    page: Int
  ): [ShopOrder!]!
  
  mySales(
    status: String
    limit: Int
    page: Int
  ): [ShopOrder!]!
  
  shopOrder(id: Int!): ShopOrder
  
  # Admin
  adminShopProducts(
    status: String
    limit: Int
    page: Int
  ): [ShopProduct!]!
  
  adminShopOrders(
    status: String
    limit: Int
    page: Int
  ): [ShopOrder!]!
}
```

#### Mutations

```graphql
type Mutation {
  # Product Management
  createShopProduct(
    categoryId: Int!
    title: String!
    description: String!
    productType: String!
    price: Int!
    stockQuantity: Int
    images: [String!]!
    digitalFileUrl: String
  ): ShopProduct!
  
  updateShopProduct(
    id: Int!
    categoryId: Int
    title: String
    description: String
    price: Int
    stockQuantity: Int
    images: [String!]
    digitalFileUrl: String
  ): ShopProduct!
  
  deleteShopProduct(id: Int!): Boolean!
  
  submitShopProductForApproval(id: Int!): ShopProduct!
  
  # Order Management
  createShopOrder(
    productId: Int!
    quantity: Int!
    shippingAddress: String
    buyerNotes: String
  ): ShopOrder!
  
  confirmShopOrder(orderId: Int!): ShopOrder!
  
  shipShopOrder(
    orderId: Int!
    trackingNumber: String
  ): ShopOrder!
  
  confirmDelivery(orderId: Int!): ShopOrder!
  
  cancelShopOrder(
    orderId: Int!
    reason: String!
  ): ShopOrder!
  
  # Admin
  approveShopProduct(id: Int!): ShopProduct!
  
  rejectShopProduct(
    id: Int!
    reason: String!
  ): ShopProduct!
  
  createShopCategory(
    name: String!
    slug: String!
    description: String
    icon: String
  ): ShopCategory!
  
  updateShopCategory(
    id: Int!
    name: String
    description: String
    icon: String
    displayOrder: Int
    isActive: Boolean
  ): ShopCategory!
}
```

### 5.2 REST Endpoints

```
POST /upload/shop-product    - Upload product images
POST /upload/shop-digital     - Upload digital product file
```

---

## 6. Business Logic

### 6.1 Product Lifecycle

```
Draft → Pending → Approved → (Active/Sold Out/Archived)
                ↓
              Rejected → Draft (can resubmit)
```

**Rules:**
- Seller creates product in `draft` status
- Seller submits for approval → `pending`
- Admin reviews → `approved` or `rejected`
- Approved products visible in marketplace
- Rejected products can be edited and resubmitted
- Products with stock_quantity = 0 → `sold_out` (auto)
- Seller can archive products anytime

### 6.2 Order Lifecycle

```
Pending → Confirmed → Shipping → Delivered → Completed
   ↓                                            ↑
Cancelled ←──────────────────────────────────────┘
```

**Status Definitions:**
- **Pending:** Order created, waiting seller confirmation
- **Confirmed:** Seller accepted order, preparing product
- **Shipping:** Product shipped (physical only), tracking number provided
- **Delivered:** Buyer received product (physical) or downloaded (digital)
- **Completed:** Buyer confirmed satisfaction, funds released to seller
- **Cancelled:** Order cancelled by buyer/seller/admin before completion

**Cancellation Rules:**
- Buyer can cancel: `pending`, `confirmed`
- Seller can cancel: `pending` only
- Admin can cancel: any status except `completed`
- Auto-cancel if seller doesn't confirm within 48 hours

### 6.3 Escrow Payment Flow

```
1. Buyer places order
   → Deduct total_price from buyer balance
   → Create escrow transaction (status: held)
   → Order status: pending
   → Payment status: held

2. Order progresses through workflow
   → Status changes: confirmed → shipping → delivered

3. Buyer confirms delivery
   → Order status: completed
   → Payment status: released
   → Calculate commission: total_price * commission_rate
   → Add seller_amount to seller balance
   → Add commission_amount to platform revenue
   → Escrow transaction status: released

4. If cancelled before completion
   → Refund total_price to buyer balance
   → Payment status: refunded
   → Escrow transaction status: refunded
```

**Commission Calculation:**
```
commission_rate = 5% (configurable via env)
commission_amount = total_price * (commission_rate / 100)
seller_amount = total_price - commission_amount
```

### 6.4 Digital Product Delivery

For `product_type = 'digital'`:
- No shipping address required
- Auto-transition: `confirmed` → `delivered` (instant)
- Buyer can download from order detail page
- Download link expires after 7 days or 3 downloads (whichever first)
- Seller uploads file via `/upload/shop-digital` (stored securely, not public)

### 6.5 Stock Management

- Physical products: `stock_quantity` decremented on order creation
- If `stock_quantity` reaches 0 → product status = `sold_out`
- If order cancelled → `stock_quantity` incremented back
- Digital products: `stock_quantity = NULL` (unlimited)

---

## 7. Frontend Design

### 7.1 New Pages

#### `/shop` - Shop Homepage
**Components:**
- Category filter tabs
- Product grid (responsive: 4 cols desktop, 2 cols mobile)
- Search bar with autocomplete
- Filter sidebar: price range, product type, sort by
- Pagination

**Mobile Considerations:**
- Bottom sheet for filters (not sidebar)
- Infinite scroll instead of pagination
- Swipeable category tabs

#### `/shop/product/:id` - Product Detail
**Components:**
- Image gallery (swipeable on mobile)
- Product info: title, price, description, category
- Seller info card (avatar, name, rating, link to profile)
- Stock status indicator
- "Mua ngay" button
- "Nhắn tin người bán" button (opens chat)
- Related products section

**Mobile Considerations:**
- Sticky bottom bar with price + buy button
- Collapsible description section

#### `/shop/checkout/:productId` - Checkout Page
**Components:**
- Product summary
- Quantity selector
- Shipping address form (physical products only)
- Buyer notes textarea
- Price breakdown: subtotal, commission (hidden from buyer), total
- Balance display + "Nạp tiền" link if insufficient
- "Đặt hàng" button

**Mobile Considerations:**
- Single-page form (no multi-step wizard)
- Sticky bottom bar with total + order button

#### `/shop/orders` - My Orders (Buyer View)
**Components:**
- Tab navigation: Tất cả, Chờ xác nhận, Đang giao, Hoàn thành, Đã hủy
- Order list with status badges
- Quick actions: Cancel, Confirm Delivery, Chat with Seller

**Mobile Considerations:**
- Swipeable tabs
- Pull-to-refresh

#### `/shop/sales` - My Sales (Seller View)
**Components:**
- Tab navigation: Tất cả, Chờ xác nhận, Đang giao, Hoàn thành, Đã hủy
- Order list with buyer info
- Quick actions: Confirm, Ship, Cancel, Chat with Buyer

#### `/shop/my-products` - My Products (Seller View)
**Components:**
- "Đăng sản phẩm mới" button
- Product list with status badges
- Quick actions: Edit, Delete, Submit for Approval

#### `/shop/product/create` - Create Product
**Components:**
- Multi-image upload (max 5 images)
- Title input (max 255 chars)
- Description textarea (rich text editor)
- Category dropdown
- Product type radio: Physical / Digital
- Price input (VND)
- Stock quantity input (physical only)
- Digital file upload (digital only)
- "Lưu nháp" and "Gửi duyệt" buttons

**Mobile Considerations:**
- Camera integration for image upload
- Simplified rich text editor (bold, italic, list only)

#### `/admin/shop` - Admin Shop Management
**Sub-pages:**
- `/admin/shop/products` - Pending product approvals
- `/admin/shop/orders` - All orders overview
- `/admin/shop/categories` - Category management
- `/admin/shop/settings` - Commission rate, policies

### 7.2 Component Reusability

**Shared Components (Web + Future Mobile):**
- `ProductCard` - Product thumbnail with price, title, seller
- `OrderCard` - Order summary with status badge
- `CategoryChip` - Category filter chip
- `PriceDisplay` - Formatted price with currency
- `StatusBadge` - Order/product status indicator
- `SellerInfo` - Seller avatar, name, rating

**Service Layer (100% Reusable):**
- `services/shop.js` - All GraphQL queries/mutations
- Business logic stays in backend, frontend just calls APIs

---

## 8. Admin Features

### 8.1 Product Approval Workflow

**Admin Dashboard:**
- Queue of pending products
- Product preview with all details
- Approve/Reject buttons
- Rejection reason textarea (required for reject)

**Approval Criteria (documented for admin):**
- No prohibited items (weapons, drugs, counterfeit)
- Clear product description
- Appropriate images (no misleading photos)
- Reasonable pricing (not obviously scam)

### 8.2 Order Management

**Admin can:**
- View all orders
- Filter by status, date range, buyer, seller
- Cancel orders with reason (refunds buyer automatically)
- View escrow transaction details
- Export order data (Phase 3)

### 8.3 Category Management

**Admin can:**
- Create new categories
- Edit category name, description, icon
- Reorder categories (display_order)
- Activate/deactivate categories
- View product count per category

### 8.4 Settings

**Configurable via Admin Panel:**
- Commission rate (default 5%)
- Auto-cancel timeout (default 48 hours)
- Max images per product (default 5)
- Max file size for digital products (default 100MB)

---

## 9. Security Considerations

### 9.1 Authorization Rules

**Product Management:**
- Only seller can edit/delete their own products
- Only admin can approve/reject products
- Public can view approved products only

**Order Management:**
- Buyer can view their purchases
- Seller can view their sales
- Only buyer can confirm delivery
- Only seller can ship order
- Admin can view all orders

**Balance Operations:**
- Escrow deduction requires sufficient buyer balance
- Escrow release requires order status = completed
- All balance changes logged in transactions table

### 9.2 Input Validation

**Backend Validators:**
- `ShopProductValidator` - title length, price > 0, valid category, image URLs
- `ShopOrderValidator` - valid product, sufficient balance, valid quantity
- `ShopCategoryValidator` - unique slug, valid name

**Frontend Validation:**
- Real-time price formatting
- Image file type/size check before upload
- Stock quantity must be integer >= 0

### 9.3 File Upload Security

**Product Images:**
- Allowed types: jpg, jpeg, png, webp
- Max size: 5MB per image
- Stored in `/uploads/shop/products/{user_id}/{timestamp}_{random}.ext`
- Image optimization: resize to max 1200px width

**Digital Products:**
- Allowed types: pdf, zip, mp4, mp3 (configurable)
- Max size: 100MB
- Stored in `/uploads/shop/digital/{user_id}/{order_id}_{random}.ext`
- Access control: only buyer of completed order can download
- Signed URLs with expiration (7 days)

---

## 10. Performance Considerations

### 10.1 Database Optimization

**Indexes:**
- `shop_products`: (status, created_at DESC) for listing
- `shop_products`: FULLTEXT (title, description) for search
- `shop_orders`: (buyer_id, status) for buyer order list
- `shop_orders`: (seller_id, status) for seller order list

**Query Optimization:**
- Product listing: eager load seller, category
- Order listing: eager load product snapshot (no JOIN to products table)
- Use pagination (limit 20 per page)

### 10.2 Caching Strategy

**Redis Cache (Future):**
- Category list (TTL: 1 hour)
- Product detail (TTL: 5 minutes)
- Seller product count (TTL: 10 minutes)

**For Phase 1 (No Redis):**
- Database query optimization sufficient
- Consider adding Redis in Phase 2

### 10.3 Image Optimization

**Multiple Sizes:**
- Thumbnail: 300x300 (for product grid)
- Medium: 600x600 (for product detail)
- Original: max 1200px (for lightbox)

**Lazy Loading:**
- Product images load on scroll (web)
- Placeholder blur effect while loading

---

## 11. Testing Strategy

### 11.1 Backend Testing

**Unit Tests (PHPUnit):**
- `ShopProductService` - create, update, approve, reject
- `ShopOrderService` - create order, escrow flow, status transitions
- `EscrowService` - hold, release, refund

**Integration Tests:**
- GraphQL mutations with database
- Escrow transaction + balance update atomicity
- Order cancellation refund flow

### 11.2 Frontend Testing

**Manual Testing Checklist:**
- Create product (physical + digital)
- Submit for approval
- Admin approve/reject
- Search and filter products
- Place order (sufficient + insufficient balance)
- Seller confirm order
- Seller ship order (physical)
- Buyer confirm delivery
- Order cancellation (buyer + seller)
- Chat integration (click "Nhắn tin")

**Mobile Responsive Testing:**
- Test on Chrome DevTools mobile emulator
- Test on actual device (iOS + Android)
- Verify touch targets (min 44x44px)

---

## 12. Migration Plan

### 12.1 Database Migration

**File:** `backend/database/migrations/021_create_shop_tables.sql`

**Contents:**
- Create `shop_categories` table
- Create `shop_products` table
- Create `shop_orders` table
- Create `shop_escrow_transactions` table
- Seed default categories
- Insert migration record

**Rollback Plan:**
- Drop tables in reverse order
- Remove migration record

### 12.2 Deployment Steps

1. **Backend:**
   - Run migration: `docker exec mxh_backend php database/migrate.php`
   - Verify tables created: `docker exec mxh_mysql mysql -u root -p -e "SHOW TABLES LIKE 'shop_%'"`
   - Restart backend: `docker compose restart backend`

2. **Frontend:**
   - Build: `docker compose build frontend`
   - Restart: `docker compose up -d --force-recreate frontend`
   - Verify: Navigate to `http://localhost:5173/shop`

3. **Smoke Test:**
   - Admin creates categories
   - User creates product
   - Admin approves product
   - Another user places order
   - Seller confirms and ships
   - Buyer confirms delivery
   - Verify balance changes

---

## 13. Future Enhancements (Phase 2 & 3)

### Phase 2:
- Voucher system (seller + admin vouchers)
- Review & rating system
- Advanced shipping tracking
- Notification for order events
- Seller analytics dashboard

### Phase 3:
- Bulk product upload (CSV)
- Product variants (size, color)
- Wishlist / Favorites
- Product comparison
- Advanced search filters
- Export reports (orders, revenue)
- Seller subscription tiers

### React Native Migration:
- Reuse all GraphQL queries/mutations from `services/shop.js`
- Rebuild UI components with React Native components
- Use React Navigation for routing
- Integrate native camera for product photos
- Push notifications for order updates

---

## 14. Decisions Made

1. **Commission Rate:** 5% (configurable via environment variable `SHOP_COMMISSION_RATE`)
2. **Auto-Cancel Timeout:** 48 hours for seller confirmation (configurable via `SHOP_AUTO_CANCEL_HOURS`)
3. **Digital File Size Limit:** 100MB (configurable via `SHOP_MAX_DIGITAL_FILE_SIZE_MB`)
4. **Category Icons:** Use emoji for Phase 1 (simple, no asset management needed)
5. **Shipping Integration:** Phase 1 manual tracking only (seller enters tracking number manually)

---

## 15. Success Metrics

**Phase 1 Launch Goals:**
- 50+ products listed within first week
- 10+ successful transactions
- < 5% order cancellation rate
- Zero escrow transaction errors
- Admin approval turnaround < 24 hours

**Technical Metrics:**
- Product listing page load < 2s
- Order placement success rate > 95%
- Mobile responsive score > 90 (Lighthouse)
- Zero SQL injection vulnerabilities
- API response time p95 < 500ms

---

## 16. Appendix

### 16.1 Order Number Format

```
Format: SHOP-YYYYMMDD-XXXXX
Example: SHOP-20260502-00001

Generation:
- Prefix: SHOP-
- Date: YYYYMMDD (order creation date)
- Sequence: 5-digit auto-increment per day
```

### 16.2 Product Snapshot Schema

Stored in `shop_orders.product_snapshot` as JSON:

```json
{
  "id": 123,
  "title": "iPhone 15 Pro Max",
  "price": 30000000,
  "images": ["url1.jpg", "url2.jpg"],
  "productType": "physical",
  "categoryName": "Điện tử",
  "sellerName": "Nguyễn Văn A"
}
```

Purpose: Preserve product details even if product is deleted/edited later.

### 16.3 Shipping Address Schema

Stored in `shop_orders.shipping_address` as JSON:

```json
{
  "fullName": "Nguyễn Văn B",
  "phone": "0901234567",
  "address": "123 Đường ABC",
  "ward": "Phường 1",
  "district": "Quận 1",
  "city": "TP. Hồ Chí Minh",
  "postalCode": "700000"
}
```

---

**End of Design Document**
