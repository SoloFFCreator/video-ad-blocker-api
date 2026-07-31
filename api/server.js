const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Allows frontend requests from your site
app.use(express.json());

// Sample in-memory database of your website's pages or blog posts
const siteContent = [
  { id: 1, title: 'Getting Started with JavaScript', url: '/blog/js-guide', description: 'Learn basic JavaScript syntax and modern ES6 features.' },
  { id: 2, title: 'HTML & CSS Layout Essentials', url: '/blog/html-css', description: 'Master flexbox and grid layouts for responsive Web design.' },
  { id: 3, title: 'Building REST APIs with Express', url: '/blog/express-api', description: 'How to construct lightweight backend APIs using Node.js.' },
];

// Search Endpoint
app.get('/api/search', (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase().trim() : '';

  if (!query) {
    return res.json({ count: 0, results: [] });
  }

  // Filter content matching the query in either title or description
  const results = siteContent.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );

  res.json({
    count: results.length,
    results
  });
});

app.listen(3000, () => {
  console.log('Search API running on http://localhost:3000');
});
