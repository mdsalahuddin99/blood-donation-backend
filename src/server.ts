import { Server } from 'http';
import app from './app';
import config from './app/config';
import prisma from './app/utils/prisma';

let server: Server;

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    server = app.listen(config.port, () => {
      console.log(`Blood Donation API listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start the server:', err);
    process.exit(1);
  }
}

main();

process.on('unhandledRejection', () => {
  console.log('Unhandled rejection detected, shutting down...');
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', () => {
  console.log('Uncaught exception detected, shutting down...');
  process.exit(1);
});
