// backend/seeder.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();
connectDB();

const importData = async () => {
  try {
    // Clear existing users to prevent duplicate key email crashes
    await User.deleteMany();

    // Inject your default valid admin credentials here
    await User.create({
      name: 'System Admin Node',
      email: 'divyan.siva.dev@gmail.com',
      password: 'password123', // This will be safely encrypted automatically by our pre-save hook!
      isAdmin: true,
    });

    console.log('🚀 Default Admin Credentials Seeded Successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Seeding Anomaly: ${error.message}`);
    process.exit(1);
  }
};

importData();