// File: /api/search.js

export default function handler(req, res) {
  // Allow cross-origin requests from your main website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser CORS preflight check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract query parameter from request (e.g., ?q=home)
  const { q } = req.query;
  const query = q ? q.toLowerCase().trim() : '';

  // Your website content index
  const siteContent = [
    { id: 1, title: 'Home Page', url: 'https://www.dipamalla.com.np/home.html', description: 'Welcome to Dipam Alla official website portfolio.' },
    { id: 2, title: 'About Me', url: 'https://www.dipamalla.com.np/about.html', description: 'Learn more about my background, skills, and projects.' },
    { id: 3, title: 'Projects', url: 'https://www.dipamalla.com.np/projects.html', description: 'Web development tools, projects, and apps built by me.' },
  ];

  if (!query) {
    return res.status(200).json({ count: 0, results: [] });
  }

  // Filter items matching title or description
  const results = siteContent.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );

  return res.status(200).json({
    count: results.length,
    results
  });
}
