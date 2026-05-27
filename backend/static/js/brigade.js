// =============================================
//  AJAX-ЗАПРОСЫ
// =============================================
async function fetchJSON(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Ошибка загрузки ${url}:`, error);
        throw error;
    }
}

function getRoleName(roleId) {
    const roles = {
        "worker": 'Техник',
        "engineer": 'Инженер',
        "high-engineer": 'Ведущий инженер'
    };
    return roles[roleId] || `Роль #${roleId}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    toast.innerHTML = `
                <span class="toast__icon">${icons[type] || icons.info}</span>
                <span>${message}</span>
            `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getRoleBadge(roleId) {
    const role = getRoleName(roleId);
    const colors = {
        'Техник': 'info',
        'Инженер': 'success',
        'Ведущий инженер': 'warning',
    };
    const color = colors[role] || 'info';
    return `<span class="badge badge--${color}"><span class="badge__dot"></span>${role}</span>`;
}

function renderTable(employees) {
    const container = document.getElementById('tableBody');

    if (employees.length === 0) {
        container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state__icon">📋</div>
                        <div class="empty-state__title">Сотрудники не найдены</div>
                        <div class="empty-state__desc">Попробуйте изменить параметры поиска</div>
                    </div>
                `;
        return;
    }

    let html = `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-sort="id">ID</th>
                                <th class="sortable" data-sort="FIO">ФИО</th>
                                <th class="sortable" data-sort="employee_code">Табельный №</th>
                                <th>Телефон</th>
                                <th>Роль</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

    employees.forEach((emp, index) => {
        html += `
                    <tr data-id="${emp._id}" style="animation-delay: ${index * 0.04}s">
                        <td><strong>${emp._id}</strong></td>
                        <td>
                            <div style="font-weight: 600;">${emp.FIO}</div>
                        </td>
                        <td><code style="background: var(--rt-gray-light); padding: 2px 6px; border-radius: 3px; font-size: 13px;">${emp.employee_code}</code></td>
                        <td style="white-space: nowrap;">${emp.telephone}</td>
                        <td>${getRoleBadge(emp.role)}</td>
                    </tr>
                `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}


async function init() {
    try {
        let crew_id = localStorage.getItem("crew_id");
        let employees = await fetchJSON(`http://localhost:8000/workers/crews_code/${crew_id}`);
        renderTable(employees);

    } catch (error) {
        console.log(error)
        document.getElementById('tableBody').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state__icon">⚠️</div>
                        <div class="empty-state__title">Ошибка загрузки данных</div>
                        <div class="empty-state__desc">${error.message}</div>
                        <button class="btn btn--primary" style="margin-top: 16px;" onclick="init()">
                            🔄 Повторить
                        </button>
                    </div>
                `;
        showToast('Не удалось загрузить данные', 'error');
    }
}

// Запуск
init();