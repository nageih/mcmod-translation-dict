export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      const queryParams = url.searchParams;
  
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };
  
      const cacheTtl = 60 * 60 * 24 * 6; // Cache for 6 days
      const cache = caches.default;
  
      if (path === "/search") {
        const query = queryParams.get("q");
        const page = parseInt(queryParams.get("page")) || 1;
        const mode = queryParams.get("mode") || "en2zh"; // Default to English-to-Chinese
        const offset = (page - 1) * 50;
  
        if (!query) {
          return new Response(
            JSON.stringify({ error: "查询参数不能为空" }),
            {
              status: 400,
              headers: { ...headers, "Content-Type": "application/json" },
            }
          );
        }
  
        const words = query.trim().toLowerCase().split(/\s+/);
        const fullMatch = query.trim().toLowerCase();
        const startMatches = words.map((word) => `${word}%`);
  
        const cacheKey = new Request(request.url, { method: "GET" });
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
  
        try {
          let placeholders, bindings, resultsPromise, countResultPromise;
          
          if (mode === "en2zh") {
            // English to Chinese search
            placeholders = startMatches.map(() => "LOWER(origin_name) LIKE ?").join(" OR ");
            bindings = [fullMatch, ...startMatches];
            
            resultsPromise = env.DB.prepare(`
              SELECT trans_name, origin_name, modid, version, key, curseforge, COUNT(*) AS frequency,
                CASE 
                  WHEN LOWER(origin_name) = ? THEN 3
                  WHEN ${placeholders} THEN 2
                  ELSE 1
                END AS match_weight
              FROM dict
              WHERE LOWER(origin_name) = ?
                OR (${placeholders})
              GROUP BY trans_name, origin_name, modid, version, key, curseforge
              ORDER BY match_weight DESC, frequency DESC
              LIMIT 50 OFFSET ?
            `).bind(...bindings, fullMatch, ...startMatches, offset).all();
  
            countResultPromise = env.DB.prepare(`
              SELECT COUNT(*) AS total 
              FROM dict 
              WHERE LOWER(origin_name) = ?
                OR (${placeholders})
            `).bind(fullMatch, ...startMatches).first();
          } else {
            // Chinese to English search
            placeholders = startMatches.map(() => "LOWER(trans_name) LIKE ?").join(" OR ");
            bindings = [fullMatch, ...startMatches];
            
            resultsPromise = env.DB.prepare(`
              SELECT trans_name, origin_name, modid, version, key, curseforge, COUNT(*) AS frequency,
                CASE 
                  WHEN LOWER(trans_name) = ? THEN 3
                  WHEN ${placeholders} THEN 2
                  ELSE 1
                END AS match_weight
              FROM dict
              WHERE LOWER(trans_name) = ?
                OR (${placeholders})
              GROUP BY trans_name, origin_name, modid, version, key, curseforge
              ORDER BY match_weight DESC, frequency DESC
              LIMIT 50 OFFSET ?
            `).bind(...bindings, fullMatch, ...startMatches, offset).all();
  
            countResultPromise = env.DB.prepare(`
              SELECT COUNT(*) AS total 
              FROM dict 
              WHERE LOWER(trans_name) = ?
                OR (${placeholders})
            `).bind(fullMatch, ...startMatches).first();
          }
  
          const [results, countResult] = await Promise.all([resultsPromise, countResultPromise]);
  
          const response = new Response(
            JSON.stringify({
              query,
              results: results,
              total: countResult.total,
              mode: mode
            }),
            {
              headers: { ...headers, "Content-Type": "application/json" },
            }
          );
  
          await cache.put(cacheKey, response.clone(), { expirationTtl: cacheTtl });
          return response;
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err.message }),
            {
              status: 500,
              headers: { ...headers, "Content-Type": "application/json" },
            }
          );
        }
      }

  	  // 处理不是 "/search" 的请求
      return new Response("Not Found", { status: 404 });
    },
  };