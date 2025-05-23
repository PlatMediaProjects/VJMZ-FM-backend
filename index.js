const express = require('express');
const app = express();

// Serve static files (like your HTML homepage) from "public" directory
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const http = require('http');

app.get('/stream', (req, res) => {
  const streamUrl = 'http://cast3.my-control-panel.com:7535/;stream.mp3'; // Asura HTTP stream

  http.get(streamUrl, (streamRes) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    streamRes.pipe(res);
  }).on('error', (err) => {
    console.error('Stream Error:', err.message);
    res.status(500).send('Stream Unavailable');
  });
});


