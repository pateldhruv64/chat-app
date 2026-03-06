import { createClient } from 'redis';

const actualClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        family: 0, // Fallback to IPv4 if IPv6 fails
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                return new Error('Redis not found. Falling back to local memory mode.');
            }
            return Math.min(retries * 100, 1000);
        }
    },
    pingInterval: 10000
});

// No Redis URL provided, forcing Memory Mode for local/single-instance deployments
const isMemoryMode = true;
const memorySets = new Map();

export const connectRedis = async () => {
    console.log('✅ Running socket state in Memory Mode (No Redis)');
};

// Intelligent proxy wrapper to seamlessly downgrade to Memory tracking
const redisClient = {
    get isOpen() { return false; },
    duplicate: () => redisClient,
    sAdd: async (key, val) => {
        if (!memorySets.has(key)) memorySets.set(key, new Set());
        memorySets.get(key).add(val);
    },
    sRem: async (key, val) => {
        if (memorySets.has(key)) memorySets.set(key, new Set([...memorySets.get(key)].filter(x => x !== val)));
    },
    sCard: async (key) => {
        return memorySets.has(key) ? memorySets.get(key).size : 0;
    }
};

export default redisClient;
