// backend/routes/adminRoutes.js
import express from 'express';
import {
  getAnalytics,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderToDelivered,
  getUsers,
  restockProductVariant,
  updateOrderToOutForDelivery,
  updateOrder,
  bulkUploadProducts,
  getAdminProducts,
  convertCategory,
  updateProductImage,
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Intercept all endpoints below with authentication and administrative protection checks
router.use(protect);
router.use(admin);

router.route('/analytics').get(getAnalytics);
router.route('/products').get(getAdminProducts).post(createProduct);
router.route('/products/convert-category').post(convertCategory);
router.route('/products/bulk').post(bulkUploadProducts);
router.route('/products/:id').put(updateProduct).delete(deleteProduct);
router.route('/products/:id/image').put(updateProductImage);
router.route('/products/:id/restock').put(restockProductVariant);

router.route('/orders').get(getOrders);
router.route('/orders/:id').put(updateOrder);
router.route('/orders/:id/out-for-delivery').put(updateOrderToOutForDelivery);
router.route('/orders/:id/deliver').put(updateOrderToDelivered);
router.route('/users').get(getUsers);

export default router;