import { EventEmitter } from "node:events";

const eventEmitter = new EventEmitter();

class NotificationEventEmitter extends EventEmitter {
    send(data) {
        this.emit("notification", data);
    }
}

const notificationEventEmitter = new NotificationEventEmitter();

export { notificationEventEmitter };

export default eventEmitter;

