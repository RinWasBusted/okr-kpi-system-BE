import { createApp } from './server.js';
import 'dotenv/config.js';

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const app = await createApp();

app.listen(PORT, HOST, () => {
  console.log(`API doc available at http://${HOST}:${PORT}/api-docs`);
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
