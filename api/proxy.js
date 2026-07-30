export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Please provide a video URL via the ?url= parameter' });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const origin = parsedUrl.origin;
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // 1. Fetch original video player page
    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
    };

    const response = await fetch(targetUrl, fetchOptions);
    let html = await response.text();

    // 2. Rewrite relative paths for JS/CSS assets
    html = html.replace(/(src|href)=["']\/(?!\/)([^"']*)["']/gi, `$1="${origin}/$2"`);
    html = html.replace(/"\/_next\//g, `"${origin}/_next/`);

    // 3. Inject Required Script for Abyss / Abyssplayer / Hydrax
    let customScripts = '';
    if (hostname.includes('abyss') || hostname.includes('abyssplayer') || hostname.includes('hydrax')) {
      customScripts += `<script src="https://cdn.jsdelivr.net/gh/hydraxnet/player.html@main/replace-domain.js"></script>\n`;
    }

    // 4. Player-Specific Ad Rules
    let playerSpecificRules = '';
    if (hostname.includes('megaplay') || hostname.includes('megacloud')) {
      playerSpecificRules = `
        const clearAds = (node) => {
          if (node.tagName === 'DIV' && node.style.position === 'absolute' && node.style.zIndex > 2000) node.remove();
        };
      `;
    } else if (hostname.includes('vidnest') || hostname.includes('animepahe')) {
      playerSpecificRules = `
        const clearAds = (node) => {
          if (node.tagName === 'A' && node.target === '_blank' && !node.href.includes('vidnest')) node.remove();
        };
      `;
    } else if (hostname.includes('abyss') || hostname.includes('abyssplayer')) {
      // Don't block legitimate player elements loaded by Hydrax or JSDelivr
      playerSpecificRules = `
        const clearAds = (node) => {
          if (node.tagName === 'IFRAME' && !node.src.includes('abyss') && !node.src.includes('hydrax') && !node.src.includes('jsdelivr')) {
            node.remove();
          }
        };
      `;
    }

    // 5. Inject Network Interceptor, Custom Scripts & Ad Destroyer
    const antiAdScript = `
      ${customScripts}
      <script>
        // --- NETWORK REWRITE FOR PROXIED APIS ---
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('/')) {
                args[0] = '${origin}' + args[0];
            }
            return originalFetch.apply(this, args);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.startsWith('/')) {
                url = '${origin}' + url;
            }
            return originalOpen.call(this, method, url, ...rest);
        };

        // --- AD & POPUP BLOCKER ---
        window.open = function() { console.log('Blocked popup.'); return null; };
        
        ${playerSpecificRules}

        document.addEventListener('DOMContentLoaded', () => {
          const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
              for (let node of mutation.addedNodes) {
                if (node.nodeType === 1) { 
                  if (typeof clearAds === 'function') clearAds(node);

                  // Universal clickjack overlay destroyer
                  const style = window.getComputedStyle(node);
                  if ((style.position === 'absolute' || style.position === 'fixed') && parseInt(style.zIndex, 10) > 999) {
                     if (node.offsetWidth > window.innerWidth * 0.5) {
                        node.remove();
                     }
                  }
                }
              }
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        });
      </script>
    `;
    
    html = html.replace('<head>', `<head>\n${antiAdScript}`);

    // 6. Return sanitized HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy the player.' });
  }
}
