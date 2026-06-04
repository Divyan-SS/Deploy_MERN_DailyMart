// backend/routes/routineRoutes.js
import express from 'express';
import {
  getMyRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from '../controllers/routineController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getMyRoutines)
  .post(protect, createRoutine); // Accepts the new custom named routine payloads smoothly!

router.route('/:id')
  .put(protect, updateRoutine)
  .delete(protect, deleteRoutine);

export default router;