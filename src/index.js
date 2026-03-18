import { createApp } from './server';

const PORT = process.env.PORT || 3000;
const app = await createApp();

app.listen(PORT, () => {
  console.log(`API doc available at http://localhost:${PORT}/api-docs`);
  console.log(`Server is running on http://localhost:${PORT}`);
});
