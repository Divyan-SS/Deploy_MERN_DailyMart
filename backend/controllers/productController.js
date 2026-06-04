// backend/controllers/productController.js
import Product from '../models/Product.js';

// @desc     Fetch all products with optional keyword fuzzy matching
// @route    GET /api/products
// @access   Public
const getProducts = async (req, res, next) => {
  try {
    const keyword = req.query.keyword
      ? {
          name: {
            $regex: req.query.keyword,
            $options: 'i', // Case-insensitive matching
          },
        }
      : {};

    // Retrieves products natively along with their dynamic nested variant arrays
    const products = await Product.find({ ...keyword });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

// @desc     Fetch single product by its ObjectId index
// @route    GET /api/products/:id
// @access   Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      res.json(product);
    } else {
      res.status(404);
      throw new Error('Product catalog match entry not found');
    }
  } catch (error) {
    next(error);
  }
};

export { getProducts, getProductById };