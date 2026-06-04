// backend/routes/productRoutes.js
import express from 'express';
import { getProducts, getProductById } from '../controllers/productController.js';

const router = express.Router();

// Public open-access paths for looking up items and dynamic pricing variances
router.route('/').get(getProducts);
router.route('/:id').get(getProductById);

export default router;