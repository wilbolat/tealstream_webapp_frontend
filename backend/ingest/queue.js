require('dotenv').config();
const { Queue, Worker, QueueEvents } = require('bullmq');
const { redis } = require('./redis');
const queue = new Queue('ingest', { connection: redis });
module.exports = { Queue, Worker, QueueEvents, queue };
