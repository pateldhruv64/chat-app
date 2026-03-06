import mongoose from 'mongoose';
import dns from 'dns';
import { Resolver } from 'dns/promises';

// Force IPv4 + use Google DNS to fix SRV lookup issues
dns.setDefaultResultOrder('ipv4first');

// Override the default DNS servers to use Google Public DNS
const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
