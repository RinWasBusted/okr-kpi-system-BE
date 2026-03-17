import { createClient } from "redis";
import "dotenv/config";

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on("error", (err) => console.error("Redis Client Error", err));

export const connectRedis = async () => {
  await client.connect();
};

export const disconnectRedis = async () => {
  await client.disconnect();
};

export default client;
