// backend/updateGst.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Product from './models/Product.js';

dotenv.config();
connectDB();

const updateGst = async () => {
  try {
    const products = await Product.find({});
    console.log(`Found ${products.length} products in database. Updating GST rates...`);

    let updatedCount = 0;
    for (const p of products) {
      const nameLower = p.name.toLowerCase();
      let gstRate = 0;

      if (nameLower.includes('rice')) {
        gstRate = 0;
      } else if (nameLower.includes('apple')) {
        gstRate = 0;
      } else if (nameLower.includes('tea powder') || nameLower.includes('tea')) {
        gstRate = 5;
      } else if (nameLower.includes('cooking oil') || nameLower.includes('oil')) {
        gstRate = 5;
      } else if (nameLower.includes('soap')) {
        gstRate = 18;
      } else if (nameLower.includes('shampoo')) {
        gstRate = 18;
      } else if (nameLower.includes('soft drink') || nameLower.includes('drink') || nameLower.includes('cola') || nameLower.includes('soda')) {
        gstRate = 28;
      } else {
        // Default fall-through fallback value for other grocery essentials
        gstRate = 5; 
      }

      p.gst = gstRate;
      await p.save();
      console.log(`Updated product "${p.name}" with GST rate ${gstRate}%`);
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} products with predefined GST rates.`);
    process.exit(0);
  } catch (err) {
    console.error(`Error updating GST: ${err.message}`);
    process.exit(1);
  }
};

updateGst();
