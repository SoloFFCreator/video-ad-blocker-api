export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Please provide a video URL via the ?url= parameter' });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    
    // 1. Fetch the original video player page
    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': parsedUrl.origin, // Mimic a real browser request to bypass basic blocks
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    };

    const response = await fetch(targetUrl, fetchOptions);
    let html = await response.text();

    // 2. Fix relative links so video assets still load from the original server
    const baseTag = `<base href="${parsedUrl.origin}">`;
    html = html.replace('<head>', `<head>\n${baseTag}`);

    // 3. Inject the Anti-Ad & Anti-Popup Script
    const antiAdScript = `
      <script>
        // 🛑 Kill Popups and Redirects
        window.open = function() { console.log('Popup blocked.'); return null; };
        window.alert = function() { return null; };
        window.confirm = function() { return false; };
        
        // 🛑 Intercept dynamic script creation for known ad networks
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const el = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'script') {
            Object.defineProperty(el, 'src', {
              set: function(val) {
                const badDomains = ['propellerads', 'popads', 'adsterra', 'exoclick', 'hilltopads', 'onclick', 'adcash'];
                if (badDomains.some(domain => val.includes(domain))) {
                  console.log('Blocked dynamic ad script:', val);
                } else {
                  el.setAttribute('src', val);
                }
              },
              get: function() { return el.getAttribute('src'); }
            });
          }
          return el;
        };

        // 🛑 Destroy invisible click-jack overlays (the "touch anywhere and an ad opens" trick)
        document.addEventListener('DOMContentLoaded', () => {
          setInterval(() => {
            // Find links or divs that are absolute/fixed and cover the whole screen
            document.querySelectorAll('a, div').forEach(node => {
              const style = window.getComputedStyle(node);
              if ((style.position === 'absolute' || style.position === 'fixed') && style.zIndex > 900) {
                if (node.offsetWidth > window.innerWidth * 0.7) {
                  node.remove(); // Nuke the invisible overlay
                }
              }
            });
          }, 1000);
        });
      </script>
    `;
    html = html.replace('<head>', `<head>\n${antiAdScript}`);

    // 4. Strip hardcoded ad scripts via regex
    html = html.replace(/<script[^>]+src=["'][^"']*(popads|propellerads|adsterra|exoclick|adcash)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');

    // 5. Send the clean HTML back
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to proxy the player.' });
  }
}
