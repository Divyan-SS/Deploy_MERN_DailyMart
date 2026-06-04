// backend/routes/orderRoutes.js
import express from 'express';
import {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  updateOrderFromEmailLink,
  cancelOrderByUser,
  customerCancelFromEmailLink,
  emailOutForDelivery,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, addOrderItems);
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id/email-action').get(updateOrderFromEmailLink);
router.route('/:id/customer-cancel').get(customerCancelFromEmailLink);
router.route('/:id/email-out-for-delivery').get(emailOutForDelivery);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/cancel').put(protect, cancelOrderByUser);

export default router;