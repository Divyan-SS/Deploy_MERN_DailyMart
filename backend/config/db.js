// backend/config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    // Explicitly logging connection host parameters to easily track remote cluster status
    console.log(`🚀 MongoDB Atlas Connected Context: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Cloud Connection Pipeline Failure: ${error.message}`);
    process.exit(1); // Force terminate node instance loop if DB link drops
  }
};

export default connectDB;