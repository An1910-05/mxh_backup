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
        images status viewCount soldCount createdAt
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
        createdAt updatedAt approvedAt
        seller { id username avatar }
        category { id name slug }
      }
    }
  `, { id: parseInt(id) });
  return data.shopProduct;
}

export async function createShopProduct(productData) {
  const data = await graphqlFetch(`
    mutation CreateShopProduct($categoryId: Int!, $title: String!, $description: String!, $productType: String!, $price: Int!, $stockQuantity: Int, $images: [String!]!, $digitalFileUrl: String) {
      createShopProduct(categoryId: $categoryId, title: $title, description: $description, productType: $productType, price: $price, stockQuantity: $stockQuantity, images: $images, digitalFileUrl: $digitalFileUrl) {
        id title status
      }
    }
  `, productData);
  return data.createShopProduct;
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
    mutation CreateShopOrder($productId: Int!, $quantity: Int!, $shippingAddress: String, $buyerNotes: String) {
      createShopOrder(productId: $productId, quantity: $quantity, shippingAddress: $shippingAddress, buyerNotes: $buyerNotes) {
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
        status paymentStatus shippingAddress trackingNumber createdAt
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

