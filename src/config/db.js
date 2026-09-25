const mongoose = require('mongoose');

let isConnected = 0;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MongoDB connection error: MONGO_URI environment variable is missing.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = conn.connections[0].readyState;
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

module.exports = connectDB;