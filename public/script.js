document.getElementById('searchButton').addEventListener('click', search)
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') search()
})

let currentPage = 1
const itemsPerPage = 50

function search(resetPage = true) {
    if (resetPage) {
        currentPage = 1 // 只有手动搜索时才重置分页
    }

    const query = document.getElementById('searchInput').value.trim()
    if (!query) {
        updateResultsUI('请输入有效的搜索词')
        return
    }

    fetch(
        `https://api.vmct-cn.top/search?q=${encodeURIComponent(query)}&page=${currentPage}`
    )
        .then(handleResponse)
        .then((data) => {
            displayResults(data)
            setupPagination(data.total, query)
        })
        .catch(handleError)
}

function handleResponse(response) {
    if (!response.ok) throw new Error('网络响应错误')
    return response.json()
}

function handleError(error) {
    console.error('查询失败:', error)
    alert('查询失败，请检查控制台日志。')
}

function updateResultsUI(message) {
    const resultsBody = document.getElementById('resultsBody')
    resultsBody.innerHTML = `<tr><td colspan="4">${message}</td></tr>`
    document.getElementById('pagination').innerHTML = ''
}

function displayResults(data) {
    const resultsBody = document.getElementById('resultsBody')
    resultsBody.innerHTML = ''

    if (!data?.results?.results?.length) {
        updateResultsUI('未找到结果')
        return
    }

    const mergedResults = mergeResults(data.results.results)
    renderResults(mergedResults, data.query)
}

// 合并相同条目的不同版本
function mergeResults(results) {
    const merged = {}
    results.forEach((item) => {
        const key = `${item.TRANS_NAME}|${item.ORIGIN_NAME}`
        if (!merged[key]) {
            merged[key] = {
                TRANS_NAME: item.TRANS_NAME,
                ORIGIN_NAME: item.ORIGIN_NAME,
                MODID: item.MODID,
                VERSIONS: new Set(),
                KEYS: new Set(),
                frequency: 0
            }
        }
        merged[key].VERSIONS.add(item.VERSION)
        merged[key].KEYS.add(item.KEY)
        merged[key].frequency += item.frequency
    })
    return merged
}

function renderResults(results, query) {
    const resultsBody = document.getElementById('resultsBody')
    Object.values(results).forEach((item) => {
        const curseforgeLink = item.CURSEFORGE
            ? `<a href="https://www.curseforge.com/minecraft/mc-mods/${item.CURSEFORGE}" target="_blank" rel="noopener noreferrer">
                <img src="curseforge.svg" alt="CurseForge" width="16" height="16">
               </a>`
            : ''

        const row = document.createElement('tr')
        row.innerHTML = `
			<td>${item.TRANS_NAME || '无翻译'}</td>
			<td>${highlightQuery(item.ORIGIN_NAME, query)}</td>
			<td title="${Array.from(item.KEYS).join('\n')}">
                ${item.MODID || '未知模组'} (${Array.from(item.VERSIONS).join(', ')})
                ${curseforgeLink}
            </td>
			<td>${item.frequency || 0}</td>
		`
        resultsBody.appendChild(row)
    })
}

function highlightQuery(text, query) {
    if (!text || !query) return text || ''
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<span class="highlight">$1</span>')
}

function setupPagination(totalItems, query) {
    const pagination = document.getElementById('pagination')
    pagination.innerHTML = ''

    const totalPages = Math.ceil(totalItems / itemsPerPage)
    if (totalPages <= 1) return

    const paginationList = document.createElement('ul')
    paginationList.className = 'pagination'

    const addPageButton = (label, page, isDisabled = false) => {
        const pageItem = document.createElement('li')
        pageItem.className = `page-item ${isDisabled ? 'disabled' : ''} ${page === currentPage ? 'active' : ''}`

        const pageLink = document.createElement('a')
        pageLink.className = 'page-link'
        pageLink.href = '#'
        pageLink.innerHTML = label
        pageLink.addEventListener('click', (e) => {
            e.preventDefault()
            if (!isDisabled && page !== currentPage) {
                currentPage = page
                search(false) // 点击分页时不重置页码
            }
        })

        pageItem.appendChild(pageLink)
        paginationList.appendChild(pageItem)
    }

    // 第一页按钮
    addPageButton('&laquo;', 1, currentPage === 1)

    // 中间页码按钮
    const maxPagesToShow = 7
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i, i)
    }

    // 最后一页按钮
    addPageButton('&raquo;', totalPages, currentPage === totalPages)

    pagination.appendChild(paginationList)
}
