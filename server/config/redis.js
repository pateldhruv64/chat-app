import { createClient } from 'redis';

const actualClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 3) {
                return new Error('Redis not found. Falling back to local memory mode.');
            }
            return Math.min(retries * 100, 500);
        }
    }
});

let isMemoryMode = false;
const memorySets = new Map();

actualClient.on('error', () => {
    if (!isMemoryMode) {
        console.warn('⚠️  Redis Client not detected on port 6379. Safely falling back to Memory Mode for local development.');
        isMemoryMode = true;
    }
});

actualClient.on('connect', () => {
    isMemoryMode = false;
    console.log('✅ Connected to Redis successfully');
});

export const connectRedis = async () => {
    try {
        await actualClient.connect();
    } catch (err) {
        isMemoryMode = true;
    }
};

// Intelligent proxy wrapper to seamlessly downgrade to Memory tracking
const redisClient = {
    get isOpen() { return actualClient.isOpen; },
    duplicate: () => actualClient.duplicate(),
    sAdd: async (key, val) => {
        if (!isMemoryMode && actualClient.isOpen) return actualClient.sAdd(key, val);
        if (!memorySets.has(key)) memorySets.set(key, new Set());
        memorySets.get(key).add(val);
    },
    sRem: async (key, val) => {
        if (!isMemoryMode && actualClient.isOpen) return actualClient.sRem(key, val);
        if (memorySets.has(key)) memorySets.get(key).delete(val);
    },
    sCard: async (key) => {
        if (!isMemoryMode && actualClient.isOpen) return actualClient.sCard(key);
        return memorySets.has(key) ? memorySets.get(key).size : 0;
    }
};

export default redisClient;
