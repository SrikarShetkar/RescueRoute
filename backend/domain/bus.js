/**
 * bus.js — Internal event bus.
 *
 * The emergency engine publishes domain events here. The Socket.IO layer
 * subscribes and forwards them to clients. Decouples the "rules" (engine)
 * from the real-time transport so neither depends on the other.
 */
const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(100);

module.exports = bus;