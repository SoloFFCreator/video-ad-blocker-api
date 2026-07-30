export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Please provide a video URL via the ?url= parameter' });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // 1. Fetch original video player page
    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': parsedUrl.origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
    };

    const response = await fetch(targetUrl, fetchOptions);
    let html = await response.text();

    // 2. Fix relative links
    const baseTag = `<base href="${parsedUrl.origin}">`;
    html = html.replace('<head>', `<head>\n${baseTag}`);

    // 3. Determine Player-Specific Logic
    let playerSpecificRules = '';

    if (hostname.includes('megaplay') || hostname.includes('megacloud')) {
      // Megaplay injects full-screen absolute divs right before play.
      playerSpecificRules = `
        console.log('Megaplay detected. Engaging specific filters.');
        const clearMegaplayAds = (node) => {
          if (node.tagName === 'DIV' && node.style.position === 'absolute' && node.style.zIndex > 20000) {
            node.remove();
          }
        };
      `;
    } else if (hostname.includes('vidnest') || hostname.includes('animepahe')) {
      // Vidnest/Animepahe use specific a-tag wrappers for clickjacking.
      playerSpecificRules = `
        console.log('Vidnest/Animepahe detected. Engaging specific filters.');
        const clearVidnestAds = (node) => {
          if (node.tagName === 'A' && node.target === '_blank' && !node.href.includes('vidnest')) {
            node.remove();
          }
        };
      `;
    } else if (hostname.includes('abyss')) {
      // Abyss uses heavily obfuscated cross-origin iframes layered over the play button.
      playerSpecificRules = `
        console.log('Abyss detected. Engaging specific filters.');
        const clearAbyssAds = (node) => {
          if (node.tagName === 'IFRAME' && !node.src.includes('abyss')) {
             node.style.display = 'none';
             node.remove();
          }
        };
      `;
    }

    // 4. Inject the Universal + Player-Specific Anti-Ad Script
    const antiAdScript = `
      <script>
        // --- UNIVERSAL BLOCKERS ---
        // Nullify popup commands completely
        window.open = function() { console.log('Blocked popup attempt.'); return null; };
        window.alert = function() { return null; };
        
        // --- PLAYER SPECIFIC LOGIC ---
        ${playerSpecificRules}

        // --- REAL-TIME MUTATION OBSERVER ---
        // This watches the DOM and destroys ad overlays the moment they spawn
        document.addEventListener('DOMContentLoaded', () => {
          const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
              for (let node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Ensure it's an element
                  
                  // Run player specific checks if they exist
                  if (typeof clearMegaplayAds === 'function') clearMegaplayAds(node);
                  if (typeof clearVidnestAds === 'function') clearVidnestAds(node);
                  if (typeof clearAbyssAds === 'function') clearAbyssAds(node);

                  // Universal overlay destroyer (catches anything that covers the screen)
                  const style = window.getComputedStyle(node);
                  if ((style.position === 'absolute' || style.position === 'fixed') && parseInt(style.zIndex, 10) > 999) {
                     if (node.offsetWidth > window.innerWidth * 0.5) {
                        console.log('Nuked invisible click-overlay.', node);
                        node.remove();
                     }
                  }
                }
              }
            }
          });

          // Start observing the entire document body for injected ads
          observer.observe(document.body, { childList: true, subtree: true });
        });
      </script>
    `;
    
    html = html.replace('<head>', `<head>\n${antiAdScript}`);

    // 5. Clean known hardcoded ad scripts from the raw HTML
    html = html.replace(/<script[^>]+src=["'][^"']*(popads|propellerads|adsterra|exoclick|adcash)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');

    // 6. Return the sanitized player
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy the player.' });
  }
}
