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

	  const cacheTtl = 60 * 60 * 24 * 6;

	  const cache = caches.default;
  
	  if (path === '/search') {
		const query = queryParams.get('q');
		const page = parseInt(queryParams.get('page')) || 1;
		const offset = (page - 1) * 50;
  
		if (!query) {
		  return new Response(JSON.stringify({ error: '查询参数不能为空' }), {
			status: 400,
			headers: { ...headers, 'Content-Type': 'application/json' },
		  });
		}
  
		const normalizedQuery = query.trim().toLowerCase();
  
		const cacheKey = new Request(request.url, { method: 'GET' });
  
		const cachedResponse = await cache.match(cacheKey);
		if (cachedResponse) {
		  return cachedResponse;
		}
  
		try {
		  const results = await env.DB.prepare(`
			SELECT trans_name, origin_name, modid, version, key, COUNT(*) AS frequency,
				   CASE
					 WHEN LOWER(origin_name) = ? THEN 3
					 WHEN LOWER(origin_name) LIKE ? THEN 2
					 ELSE 1
				   END AS match_weight
			FROM dict
			WHERE LOWER(origin_name) LIKE ?
			GROUP BY trans_name, origin_name, modid, version, key
			ORDER BY match_weight DESC, frequency DESC
			LIMIT 50 OFFSET ?
		  `)
		  .bind(normalizedQuery, `%${normalizedQuery}%`, `%${normalizedQuery}%`, offset)
		  .all();
  
		  const countResult = await env.DB.prepare(`
			SELECT COUNT(*) AS total FROM dict WHERE LOWER(origin_name) LIKE ?
		  `)
		  .bind(`%${normalizedQuery}%`)
		  .first();
  
		  const response = new Response(JSON.stringify({
			query,
			results: results,
			total: countResult.total,
		  }), {
			headers: { ...headers, 'Content-Type': 'application/json' },
		  });
  
		  await cache.put(cacheKey, response.clone(), { expirationTtl: cacheTtl });
		  return response;
		} catch (err) {
		  return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
		  });
		}
	  }
  
	  return new Response('Not Found', { status: 404 });
	}
  };