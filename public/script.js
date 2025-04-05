document.addEventListener("DOMContentLoaded", () => {
    const searchButton = document.getElementById("searchButton");
    const searchInput = document.getElementById("searchInput");
    const searchMode = document.getElementById("searchMode");
    const resultsBody = document.getElementById("resultsBody");
    const pagination = document.getElementById("pagination");

    searchButton.addEventListener("click", () => search());
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            search();
        }
    });

    let currentPage = 1;
    const itemsPerPage = 50;

    function search(resetPage = true) {
        if (resetPage) currentPage = 1;

        const query = searchInput.value.trim();
        if (!query) return updateResultsUI("请输入有效的搜索词");

        const mode = searchMode.value;
        fetch(`https://api.vmct-cn.top/search?q=${encodeURIComponent(query)}&page=${currentPage}&mode=${mode}`)
            .then((response) => {
                if (!response.ok) throw new Error("网络响应错误");
                return response.json();
            })
            .then((data) => {
                if (!data?.results?.results?.length) {
                    updateResultsUI("未找到结果");
                    return;
                }

                const mergedResults = mergeResults(data.results.results);
                displayResults(mergedResults, query, mode);
                setupPagination(data.total, query, mode);
            })
            .catch((error) => {
                console.error("查询失败:", error);
                alert("查询失败，请检查控制台日志。");
            });
    }

    function updateResultsUI(message) {
        resultsBody.innerHTML = `<tr><td colspan="4">${message}</td></tr>`;
        pagination.innerHTML = "";
    }

    function mergeResults(results) {
        const merged = new Map();

        results.forEach((item) => {
            const key = `${item.TRANS_NAME}|${item.ORIGIN_NAME}`;
            if (!merged.has(key)) {
                merged.set(key, {
                    TRANS_NAME: item.TRANS_NAME,
                    ORIGIN_NAME: item.ORIGIN_NAME,
                    MODID: item.MODID,
                    VERSIONS: new Set(),
                    KEYS: new Set(),
                    CURSEFORGE: item.CURSEFORGE || "",
                    frequency: 0,
                });
            }

            const entry = merged.get(key);
            entry.VERSIONS.add(item.VERSION);
            entry.KEYS.add(item.KEY);
            entry.frequency += item.frequency;
        });

        return [...merged.values()];
    }

    function displayResults(results, query, mode) {
        resultsBody.innerHTML = "";

        results.forEach((item) => {
            const curseforgeLink = item.CURSEFORGE
                ? `<a href="https://www.curseforge.com/minecraft/mc-mods/${item.CURSEFORGE}" 
                       target="_blank" rel="noopener noreferrer" title="在 CurseForge 查看">
                       <img src="curseforge.svg" alt="CurseForge" width="16" height="16">
                   </a>`
                : "";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.TRANS_NAME || "无翻译"}</td>
                <td>${highlightQuery(item.ORIGIN_NAME, query)}</td>
                <td title="${Array.from(item.KEYS).join("\n")}">
                    ${item.MODID || "未知模组"} (${Array.from(item.VERSIONS).join(", ")})
                    ${curseforgeLink}
                </td>
                <td>${item.frequency || 0}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    function highlightQuery(text, query) {
        if (!text || !query) return text || "";

        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        return text.replace(regex, (match) => `<span class="highlight">${match}</span>`);
    }

    function setupPagination(totalItems, query, mode) {
        pagination.innerHTML = "";

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) return;

        const paginationList = document.createElement("ul");
        paginationList.className = "pagination";

        function addPageButton(label, page, isDisabled = false) {
            const pageItem = document.createElement("li");
            pageItem.className = `page-item ${isDisabled ? "disabled" : ""} ${page === currentPage ? "active" : ""}`;

            const pageLink = document.createElement("a");
            pageLink.className = "page-link";
            pageLink.href = "#";
            pageLink.innerHTML = label;

            if (!isDisabled && page !== currentPage) {
                pageLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    currentPage = page;
                    search(false);
                });
            }

            pageItem.appendChild(pageLink);
            paginationList.appendChild(pageItem);
        }

        addPageButton("&laquo;", 1, currentPage === 1);

        const maxPagesToShow = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            addPageButton(i, i);
        }

        addPageButton("&raquo;", totalPages, currentPage === totalPages);

        pagination.appendChild(paginationList);
    }
});
