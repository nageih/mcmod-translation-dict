// Helper function to generate simple word forms (plural, -ing, -ed, and basic root)
function generateWordForms(word) {
    const forms = new Set([word]);
    // Simple pluralization
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || word.endsWith('ch') || word.endsWith('sh')) {
        forms.add(word + 'es');
    } else if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length - 2])) {
        forms.add(word.slice(0, -1) + 'ies'); // e.g., fly -> flies
    } else {
        forms.add(word + 's');
    }
    // Simple -ing form
    if (word.endsWith('e') && !word.endsWith('ee') && word.length > 1) {
         forms.add(word.slice(0, -1) + 'ing'); // e.g., mine -> mining
    } else if (word.length > 1 && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length-2]) && ['a', 'e', 'i', 'o', 'u'].includes(word[word.length-1])) {
         // Basic consonant doubling heuristic (can be inaccurate)
         // forms.add(word + word[word.length - 1] + 'ing');
         forms.add(word + 'ing'); // Safer default
    }
     else {
        forms.add(word + 'ing');
    }
    // Simple past tense -ed
    if (word.endsWith('e')) {
        forms.add(word + 'd');
    } else if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length - 2])) {
         forms.add(word.slice(0, -1) + 'ied');
    }
    else {
        forms.add(word + 'ed');
    }
    // Attempt to find root by removing suffixes
    if (word.endsWith('s') && word.length > 1) forms.add(word.slice(0, -1));
    if (word.endsWith('es') && word.length > 2) forms.add(word.slice(0, -2));
    if (word.endsWith('ing') && word.length > 3) {
        forms.add(word.slice(0, -3)); // e.g., mining -> min
        if (!word.endsWith('ling')) forms.add(word.slice(0, -3) + 'e'); // e.g., mining -> mine (avoid double 'e')
    }
     if (word.endsWith('ed') && word.length > 2) {
        forms.add(word.slice(0, -2)); // e.g., mined -> min
        if (!word.endsWith('led')) forms.add(word.slice(0, -2) + 'e'); // e.g., mined -> mine
    }

    return Array.from(forms).filter(f => f.length > 0); // Return non-empty forms
}


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

        const searchTerm = query.trim().toLowerCase();
        let searchForms = [searchTerm]; // Default to just the search term

        // Generate word forms only for single-word English searches for now
        if (mode === 'en2zh' && !searchTerm.includes(' ') && searchTerm.match(/^[a-z]+$/i)) {
             searchForms = generateWordForms(searchTerm);
        }

        const cacheKey = new Request(request.url, { method: "GET" });
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
            let resultsPromise, countResultPromise;
            let whereClauses = [];
            let whereBindings = [];
            let countBindings = [];
            let caseClauses = [];
            let caseBindings = [];

            const targetColumn = mode === "en2zh" ? "origin_name" : "trans_name";
            const prefixSearchTerm = `${searchTerm}%`;

            // --- Build WHERE clause and bindings ---

            // 1. Exact match condition (highest priority)
            whereClauses.push(`LOWER(${targetColumn}) = ?`);
            whereBindings.push(searchTerm);
            countBindings.push(searchTerm);
            caseClauses.push(`WHEN LOWER(${targetColumn}) = ? THEN 3`);
            caseBindings.push(searchTerm);

            // 2. Word form matches (medium priority) - Only for en2zh single word
            const uniqueForms = searchForms.filter(form => form !== searchTerm); // Exclude exact match
            if (mode === 'en2zh' && uniqueForms.length > 0) {
                const formPlaceholders = uniqueForms.map(() => `LOWER(${targetColumn}) = ?`).join(" OR ");
                whereClauses.push(`(${formPlaceholders})`);
                whereBindings.push(...uniqueForms);
                countBindings.push(...uniqueForms);
                caseClauses.push(`WHEN (${formPlaceholders}) THEN 2`);
                caseBindings.push(...uniqueForms);
            } else if (mode === 'zh2en') {
                 // For zh2en, allow LIKE for broader matching, but lower priority than exact
                 whereClauses.push(`LOWER(${targetColumn}) LIKE ?`);
                 whereBindings.push(prefixSearchTerm);
                 countBindings.push(prefixSearchTerm);
                 caseClauses.push(`WHEN LOWER(${targetColumn}) LIKE ? THEN 1`); // Give LIKE lower weight
                 caseBindings.push(prefixSearchTerm);
            }


            // 3. Prefix match (lowest priority - only for en2zh if forms weren't generated or didn't cover prefix)
            // Check if prefix match is already covered by exact or form matches
            const prefixCovered = searchForms.some(form => prefixSearchTerm.startsWith(form));
            if (mode === 'en2zh' && !prefixCovered) {
                whereClauses.push(`LOWER(${targetColumn}) LIKE ?`);
                whereBindings.push(prefixSearchTerm);
                countBindings.push(prefixSearchTerm);
                caseClauses.push(`WHEN LOWER(${targetColumn}) LIKE ? THEN 1`);
                caseBindings.push(prefixSearchTerm);
            }

            // --- Construct the full WHERE clause and CASE statement ---
            const fullWhereClause = whereClauses.join(" OR ");
            const matchWeightCase = `CASE ${caseClauses.join(" ")} ELSE 0 END`;

            // --- Prepare and bind the queries ---
            const finalSelectBindings = [...caseBindings, ...whereBindings, offset]; // Bindings for CASE, then WHERE, then OFFSET
            const finalCountBindings = countBindings; // Bindings for count WHERE

            resultsPromise = env.DB.prepare(`
                SELECT trans_name, origin_name, modid, version, key, curseforge, COUNT(*) AS frequency,
                       (${matchWeightCase}) AS match_weight
                FROM dict
                WHERE ${fullWhereClause}
                GROUP BY trans_name, origin_name, modid, version, key, curseforge
                HAVING match_weight > 0 -- Ensure we only get matching rows
                ORDER BY match_weight DESC, frequency DESC
                LIMIT 50 OFFSET ?
            `).bind(...finalSelectBindings).all();

            // Use COUNT(DISTINCT ...) for a more accurate count reflecting grouped results
            countResultPromise = env.DB.prepare(`
                SELECT COUNT(DISTINCT trans_name, origin_name, modid, version, key, curseforge) AS total
                FROM dict
                WHERE ${fullWhereClause}
            `).bind(...finalCountBindings).first();


            const [results, countResult] = await Promise.all([resultsPromise, countResultPromise]);
  
          const response = new Response(
            JSON.stringify({
              query: query, // Keep original query for display
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
          console.error("Search Error:", err); // Log the actual error
          return new Response(
            JSON.stringify({ error: "数据库查询出错: " + err.message }), // Provide more specific error
            {
              status: 500,
              headers: { ...headers, "Content-Type": "application/json" },
            }
          );
        }
      }

      // 处理不是 "/search" 的请求
      return new Response("Not Found", { status: 404, headers });
    },
};
