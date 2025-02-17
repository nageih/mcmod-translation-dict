document.getElementById('searchButton').addEventListener('click', search);
document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        search();
    }
});

let currentPage = 1;
const itemsPerPage = 50;

function search() {
    const query = document.getElementById('searchInput').value.trim(); // 去除前后空格

    // 检查输入是否为空或全是空格
    if (!query) {
        // 清空搜索结果
        const resultsBody = document.getElementById('resultsBody');
        resultsBody.innerHTML = '<tr><td colspan="4">请输入有效的搜索词</td></tr>';

        // 清空分页
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        return;
    }

    fetch(`https://api.vmct-cn.top/search?q=${encodeURIComponent(query)}&page=${currentPage}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应错误');
            }
            return response.json();
        })
        .then(data => {
            console.log('解析的数据:', data);
            if (!data || !data.results) {
                throw new Error('无效的响应数据');
            }
            displayResults(data);
            setupPagination(data.total, query);
        })
        .catch(error => {
            console.error('查询失败:', error);
            alert('查询失败，请检查控制台日志。');
        });
}

function displayResults(data) {
    const resultsBody = document.getElementById('resultsBody');
    resultsBody.innerHTML = '';

    if (!data.results || !data.results.results || data.results.results.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="4">未找到结果</td></tr>';
        return;
    }

    const resultArray = data.results.results;

    // 合并相同条目的不同版本
    const mergedResults = {};
    resultArray.forEach(item => {
        const key = `${item.TRANS_NAME}|${item.ORIGIN_NAME}`;
        if (!mergedResults[key]) {
            mergedResults[key] = {
                TRANS_NAME: item.TRANS_NAME,
                ORIGIN_NAME: item.ORIGIN_NAME,
                MODID: item.MODID,
                VERSIONS: new Set(),
                KEYS: new Set(),
                frequency: 0
            };
        }
        mergedResults[key].VERSIONS.add(item.VERSION);
        mergedResults[key].KEYS.add(item.KEY);
        mergedResults[key].frequency += item.frequency;
    });

    // 渲染合并后的结果
    Object.values(mergedResults).forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.TRANS_NAME || '无翻译'}</td>
            <td>${highlightQuery(item.ORIGIN_NAME, data.query)}</td>
            <td title="${Array.from(item.KEYS).join('\n')}">${item.MODID || '未知模组'} (${Array.from(item.VERSIONS).join(', ')})</td>
            <td>${item.frequency || 0}</td>
        `;
        resultsBody.appendChild(row);
    });
}

function highlightQuery(text, query) {
    if (!text || !query) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function setupPagination(totalItems, query) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.createElement('nav');
    const paginationList = document.createElement('ul');
    paginationList.className = 'pagination';

    // 添加“第一页”箭头按钮
    const firstPageItem = document.createElement('li');
    firstPageItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;

    const firstPageLink = document.createElement('a');
    firstPageLink.className = 'page-link';
    firstPageLink.href = '#';
    firstPageLink.innerHTML = '&laquo;'; // 左箭头符号
    firstPageLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage = 1;
            search();
        }
    });

    firstPageItem.appendChild(firstPageLink);
    paginationList.appendChild(firstPageItem);

    const maxPagesToShow = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;

        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.innerText = i;
        pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            search();
        });

        pageItem.appendChild(pageLink);
        paginationList.appendChild(pageItem);
    }

    // 添加“最后一页”箭头按钮
    const lastPageItem = document.createElement('li');
    lastPageItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;

    const lastPageLink = document.createElement('a');
    lastPageLink.className = 'page-link';
    lastPageLink.href = '#';
    lastPageLink.innerHTML = '&raquo;'; // 右箭头符号
    lastPageLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage = totalPages;
            search();
        }
    });

    lastPageItem.appendChild(lastPageLink);
    paginationList.appendChild(lastPageItem);

    paginationContainer.appendChild(paginationList);
    pagination.appendChild(paginationContainer);
}

function loadLastUpdated() {
    fetch('https://api.vmct-cn.top/lastUpdated')
        .then(response => response.json())
        .then(data => {
            document.getElementById('lastUpdated').innerText = `词典翻译数据由 CFPA 提供，基于 CC BY-NC-SA 4.0 协议。最后更新于：${data.lastUpdated}`;
        })
        .catch(console.error);
}

loadLastUpdated();