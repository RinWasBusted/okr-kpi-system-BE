import { createClient } from "redis";
import "dotenv/config";

const subscriber = createClient({
    url: process.env.REDIS_URL
});
const publisher = createClient({
    url: process.env.REDIS_URL
});   
subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
publisher.on('error', (err) => console.error('Redis Publisher Error', err));

try {
    await subscriber.connect();
    await publisher.connect();
    console.log('Connected to Redis sub/pub successfully');
} catch (err) {
    console.error('Error connecting to Redis:', err);
}

export async function notificationEventListener(user_id, callback) {
    await subscriber.subscribe(`notifications:${user_id}`, callback);
}

export async function stopListening(user_id, callback) {
    await subscriber.unsubscribe(`notifications:${user_id}`, callback);
}

export async function sendNotification(user_ids, data) {
    const stringData = JSON.stringify(data);

    const tasks = user_ids.map((user_id) => publisher.publish(`notifications:${user_id}`, stringData));
    await Promise.all(tasks);
}