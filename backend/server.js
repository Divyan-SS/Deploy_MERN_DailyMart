// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import routineRoutes from './routes/routineRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Initialize environmental parameter configurations prior to boot execution blocks
dotenv.config();

// Direct hit cloud database connection routine invocation
connectDB();

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routing API registration map matrices
app.use('/api/users', authRoutes); // CORRECTED: Swapped /api/auth to /api/users to match client endpoints cleanly
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint entry verification
app.get('/', (req, res) => {
  res.send('API is running securely...');
});

// Structural Exception Handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`📡 Server running in ${process.env.NODE_ENV} mode securely on port ${PORT}`);
});
// Nodemon trigger comment