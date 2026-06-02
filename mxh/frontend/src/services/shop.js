import { graphqlFetch } from './api';

// Shop Categories
export async function getShopCategories() {
  const data = await graphqlFetch(`
    query {
      shopCategories {
        id name slug description icon displayOrder isActive productCount
      }
    }
  `);
  return data.shopCategories;
}

// Shop Products
export async function getShopProducts(filters = {}) {
  const { categoryId, sellerId, status, productType, search, limit = 20, page = 1 } = filters;
  const data = await graphqlFetch(`
    query GetShopProducts($categoryId: Int, $sellerId: Int, $status: String, $productType: String, $search: String, $limit: Int, $page: Int) {
      shopProducts(categoryId: $categoryId, sellerId: $sellerId, status: $status, productType: $productType, search: $search, limit: $limit, page: $page) {
        id sellerId categoryId title description productType price stockQuantity
        images status viewCount soldCount createdAt ratingAvg reviewCount
        variants { id name price stockQuantity image }
        seller { id username avatar }
        category { id name slug }
      }
    }
  `, { categoryId, sellerId, status, productType, search, limit, page });
  return data.shopProducts;
}

export async function getShopProduct(id) {
  const data = await graphqlFetch(`
    query GetShopProduct($id: Int!) {
      shopProduct(id: $id) {
        id sellerId categoryId title description productType price stockQuantity
        images digitalFileUrl status rejectionReason viewCount soldCount
        createdAt updatedAt approvedAt ratingAvg reviewCount
        variants { id name price stockQuantity image }
        seller { id username avatar }
        category { id name slug }
      }
    }
  `, { id: parseInt(id) });
  return data.shopProduct;
}

export async function createShopProduct(productData) {
  const data = await graphqlFetch(`
    mutation CreateShopProduct($categoryId: Int!, $title: String!, $description: String!, $productType: String!, $price: Int!, $stockQuantity: Int, $images: [String!]!, $digitalFileUrl: String, $variants: [ShopProductVariantInput!]) {
      createShopProduct(categoryId: $categoryId, title: $title, description: $description, productType: $productType, price: $price, stockQuantity: $stockQuantity, images: $images, digitalFileUrl: $digitalFileUrl, variants: $variants) {
        id title status
      }
    }
  `, productData);
  return data.createShopProduct;
}

export async function updateShopProduct(id, productData) {
  const data = await graphqlFetch(`
    mutation UpdateShopProduct($id: Int!, $categoryId: Int, $title: String, $description: String, $price: Int, $stockQuantity: Int, $images: [String!], $digitalFileUrl: String, $variants: [ShopProductVariantInput!]) {
      updateShopProduct(id: $id, categoryId: $categoryId, title: $title, description: $description, price: $price, stockQuantity: $stockQuantity, images: $images, digitalFileUrl: $digitalFileUrl, variants: $variants) {
        id sellerId categoryId title description productType price stockQuantity
        images status viewCount soldCount createdAt
        variants { id name price stockQuantity image }
        seller { id username avatar }
        category { id name slug }
      }
    }
  `, { id: parseInt(id), ...productData });
  return data.updateShopProduct;
}

export async function deleteShopProduct(id) {
  const data = await graphqlFetch(`
    mutation DeleteShopProduct($id: Int!) {
      deleteShopProduct(id: $id)
    }
  `, { id: parseInt(id) });
  return data.deleteShopProduct;
}

export async function createShopOrder(orderData) {
  const data = await graphqlFetch(`
    mutation CreateShopOrder($productId: Int!, $variantId: Int, $quantity: Int!, $shippingAddress: String, $buyerNotes: String) {
      createShopOrder(productId: $productId, variantId: $variantId, quantity: $quantity, shippingAddress: $shippingAddress, buyerNotes: $buyerNotes) {
        id orderNumber status
      }
    }
  `, orderData);
  return data.createShopOrder;
}

export async function getMyPurchases(filters = {}) {
  const { status, limit = 20, page = 1 } = filters;
  const data = await graphqlFetch(`
    query GetMyPurchases($status: String, $limit: Int, $page: Int) {
      myPurchases(status: $status, limit: $limit, page: $page) {
        id orderNumber buyerId sellerId productId quantity unitPrice totalPrice
        status paymentStatus shippingAddress trackingNumber shippingCarrier createdAt
        buyer { id username avatar }
        seller { id username avatar }
        productSnapshot
      }
    }
  `, { status, limit, page });
  return data.myPurchases;
}

export async function confirmDelivery(orderId) {
  const data = await graphqlFetch(`
    mutation ConfirmDelivery($orderId: Int!) {
      confirmDelivery(orderId: $orderId) {
        id orderNumber status
      }
    }
  `, { orderId: parseInt(orderId) });
  return data.confirmDelivery;
}

export async function cancelShopOrder(orderId, reason) {
  const data = await graphqlFetch(`
    mutation CancelShopOrder($orderId: Int!, $reason: String!) {
      cancelShopOrder(orderId: $orderId, reason: $reason) {
        id orderNumber status cancellationReason
      }
    }
  `, { orderId: parseInt(orderId), reason });
  return data.cancelShopOrder;
}

// ============== Seller Applications ==============
const APPLICATION_FIELDS = `
  id userId storeName intro phone address status
  rejectionReason reviewedBy reviewedAt createdAt
  applicantUsername applicantEmail reviewerUsername
`;

export async function getMyShopApplication() {
  const data = await graphqlFetch(`query { myShopApplication { ${APPLICATION_FIELDS} } }`);
  return data.myShopApplication;
}

export async function registerShopSeller({ storeName, intro, phone, address }) {
  const data = await graphqlFetch(`
    mutation RegisterShopSeller($storeName: String!, $intro: String!, $phone: String!, $address: String!) {
      registerShopSeller(storeName: $storeName, intro: $intro, phone: $phone, address: $address) {
        ${APPLICATION_FIELDS}
      }
    }
  `, { storeName, intro, phone, address });
  return data.registerShopSeller;
}

export async function getShopSellerApplications(status = 'pending', limit = 50, page = 1) {
  const data = await graphqlFetch(`
    query GetShopSellerApplications($status: String, $limit: Int, $page: Int) {
      shopSellerApplications(status: $status, limit: $limit, page: $page) {
        ${APPLICATION_FIELDS}
      }
    }
  `, { status, limit, page });
  return data.shopSellerApplications;
}

export async function approveShopSeller(id) {
  const data = await graphqlFetch(`
    mutation ApproveShopSeller($id: Int!) {
      approveShopSeller(id: $id) { ${APPLICATION_FIELDS} }
    }
  `, { id: parseInt(id) });
  return data.approveShopSeller;
}

export async function rejectShopSeller(id, reason) {
  const data = await graphqlFetch(`
    mutation RejectShopSeller($id: Int!, $reason: String!) {
      rejectShopSeller(id: $id, reason: $reason) { ${APPLICATION_FIELDS} }
    }
  `, { id: parseInt(id), reason });
  return data.rejectShopSeller;
}

// ============== Orders (seller side) ==============
export async function getMySales(filters = {}) {
  const { status, limit = 20, page = 1 } = filters;
  const data = await graphqlFetch(`
    query GetMySales($status: String, $limit: Int, $page: Int) {
      mySales(status: $status, limit: $limit, page: $page) {
        id orderNumber buyerId sellerId productId quantity unitPrice totalPrice
        status paymentStatus shippingAddress trackingNumber shippingCarrier buyerNotes sellerNotes
        commissionAmount sellerAmount cancellationReason cancelledBy
        createdAt confirmedAt shippedAt deliveredAt completedAt cancelledAt
        buyer { id username avatar }
        seller { id username avatar }
        productSnapshot
      }
    }
  `, { status, limit, page });
  return data.mySales;
}

export async function confirmShopOrder(orderId) {
  const data = await graphqlFetch(`
    mutation ConfirmShopOrder($orderId: Int!) {
      confirmShopOrder(orderId: $orderId) {
        id orderNumber status confirmedAt
      }
    }
  `, { orderId: parseInt(orderId) });
  return data.confirmShopOrder;
}

export async function shipShopOrder(orderId, trackingNumber, shippingCarrier) {
  const data = await graphqlFetch(`
    mutation ShipShopOrder($orderId: Int!, $trackingNumber: String, $shippingCarrier: String) {
      shipShopOrder(orderId: $orderId, trackingNumber: $trackingNumber, shippingCarrier: $shippingCarrier) {
        id orderNumber status trackingNumber shippingCarrier shippedAt
      }
    }
  `, { orderId: parseInt(orderId), trackingNumber: trackingNumber || null, shippingCarrier: shippingCarrier || null });
  return data.shipShopOrder;
}

export async function getOrderTracking(orderId) {
  const data = await graphqlFetch(`
    query OrderTracking($orderId: Int!) {
      orderTracking(orderId: $orderId) { time status label }
    }
  `, { orderId: parseInt(orderId) });
  return data.orderTracking || [];
}

// ============== Reviews ==============
const REVIEW_FIELDS = `
  id orderId productId buyerId sellerId rating content images
  sellerReply repliedAt createdAt updatedAt productTitle
  buyer { id username avatar }
`;

export async function getProductReviews(productId, { rating = null, limit = 20, page = 1 } = {}) {
  const data = await graphqlFetch(`
    query ProductReviews($productId: Int!, $rating: Int, $limit: Int, $page: Int) {
      productReviews(productId: $productId, rating: $rating, limit: $limit, page: $page) {
        ${REVIEW_FIELDS}
      }
    }
  `, { productId: parseInt(productId), rating, limit, page });
  return data.productReviews;
}

export async function getProductReviewStats(productId) {
  const data = await graphqlFetch(`
    query ProductReviewStats($productId: Int!) {
      productReviewStats(productId: $productId) {
        total avgRating star5 star4 star3 star2 star1 withImages
      }
    }
  `, { productId: parseInt(productId) });
  return data.productReviewStats;
}

export async function getSellerReviewStats(sellerId) {
  const data = await graphqlFetch(`
    query SellerReviewStats($sellerId: Int!) {
      sellerReviewStats(sellerId: $sellerId) {
        total avgRating
      }
    }
  `, { sellerId: parseInt(sellerId) });
  return data.sellerReviewStats;
}

export async function getMyReviewForOrder(orderId) {
  const data = await graphqlFetch(`
    query MyReviewForOrder($orderId: Int!) {
      myReviewForOrder(orderId: $orderId) { ${REVIEW_FIELDS} }
    }
  `, { orderId: parseInt(orderId) });
  return data.myReviewForOrder;
}

export async function createShopReview({ orderId, rating, content, images = [] }) {
  const data = await graphqlFetch(`
    mutation CreateShopReview($orderId: Int!, $rating: Int!, $content: String!, $images: [String!]) {
      createShopReview(orderId: $orderId, rating: $rating, content: $content, images: $images) {
        ${REVIEW_FIELDS}
      }
    }
  `, { orderId: parseInt(orderId), rating: parseInt(rating), content, images });
  return data.createShopReview;
}

export async function updateShopReview({ id, rating, content, images }) {
  const data = await graphqlFetch(`
    mutation UpdateShopReview($id: Int!, $rating: Int, $content: String, $images: [String!]) {
      updateShopReview(id: $id, rating: $rating, content: $content, images: $images) {
        ${REVIEW_FIELDS}
      }
    }
  `, { id: parseInt(id), rating: rating ? parseInt(rating) : null, content: content ?? null, images: images ?? null });
  return data.updateShopReview;
}

export async function replyShopReview({ id, reply }) {
  const data = await graphqlFetch(`
    mutation ReplyShopReview($id: Int!, $reply: String!) {
      replyShopReview(id: $id, reply: $reply) { ${REVIEW_FIELDS} }
    }
  `, { id: parseInt(id), reply });
  return data.replyShopReview;
}

export async function deleteShopReview(id) {
  const data = await graphqlFetch(`
    mutation DeleteShopReview($id: Int!) {
      deleteShopReview(id: $id)
    }
  `, { id: parseInt(id) });
  return data.deleteShopReview;
}

// ============== Seller info ==============
export async function getSellerInfo(sellerId) {
  const data = await graphqlFetch(`
    query SellerInfo($sellerId: Int!) {
      user(id: $sellerId) {
        id username avatar custom_url is_seller
      }
    }
  `, { sellerId: parseInt(sellerId) });
  return data.user;
}


