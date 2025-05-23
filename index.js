const express = require('express');
const http = require('http');
const app = express();

const PORT = process.env.PORT || 3000;

// Stream proxy route
app.get('/stream', (req, res) => {
  const streamUrl = 'http://cast3.my-control-panel.com:7535/;stream.mp3';
  http.get(streamUrl, (streamRes) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    streamRes.pipe(res);
  }).on('error', (err) => {
    console.error('Stream Error:', err.message);
    res.status(500).send('Stream Unavailable');
  });
});

// Basic root message
app.get('/', (req, res) => {
  res.send('🎧 VJMZ-FM Backend is Live');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});





