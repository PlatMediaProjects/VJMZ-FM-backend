# VJMZ-FM Web Frontend

This is the public-facing homepage for VJMZ-FM, featuring a burgundy and black theme.

## Deployment Instructions (Render)

1. Place the contents of the `public/` folder into your Node.js app.
2. Use the following Express.js code to serve it:

```js
import express from 'express';
import path from 'path';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.get('*', (req, res) => {
  res.sendFile(path.resolve('public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

3. Push your changes to GitHub and let Render redeploy your service.
