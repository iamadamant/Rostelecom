// =============================================
//  КОНФИГУРАЦИЯ API
// =============================================
const API = {
    employees: ORIGIN + 'workers',
    crews: ORIGIN + 'crews',
    originalAssignments: ORIGIN + 'left/workers/crewed_workers',
    setAssignment: ORIGIN + 'workers'
};

// Для демо-режима (без реального API)
// установите DEMO_MODE = true
const DEMO_MODE = false;

// =============================================
//  СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// =============================================
const state = {
    employees: [],
    crews: [],
    originalAssignments: {}, // { employeeId: crewId } — начальные значения
    pendingChanges: {}, // { employeeId: crewId } — изменения
    filteredEmployees: [],
    sortColumn: null,
    sortDirection: 'asc',
};

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

async function postJSON(url, body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Ошибка POST ${url}:`, error);
        throw error;
    }
}

async function loadEmployees() {
    if (DEMO_MODE) return [...DEMO_EMPLOYEES];
    return await fetchJSON(API.employees);
}

async function loadCrews() {
    if (DEMO_MODE) return [...DEMO_CREWS];
    return await fetchJSON(API.crews);
}

// =============================================
//  УТИЛИТЫ
// =============================================
function getRoleName(roleId) {
    const roles = {
        "worker": 'Техник',
        "engineer": 'Инженер',
        "high-engineer": 'Ведущий инженер'
    };
    return roles[roleId] || `Роль #${roleId}`;
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

// =============================================
//  УВЕДОМЛЕНИЯ (TOAST)
// =============================================
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

// =============================================
//  МОДАЛЬНОЕ ОКНО
// =============================================
let modalResolve = null;

function showModal(title, message) {
    return new Promise((resolve) => {
        modalResolve = resolve;
        document.querySelector('.modal__title').textContent = title;
        document.getElementById('modalBody').innerHTML = message;
        document.getElementById('confirmModal').classList.add('visible');
    });
}

function hideModal() {
    document.getElementById('confirmModal').classList.remove('visible');
}

document.getElementById('modalClose').addEventListener('click', () => {
    hideModal();
    if (modalResolve) modalResolve(false);
});

document.getElementById('modalCancel').addEventListener('click', () => {
    hideModal();
    if (modalResolve) modalResolve(false);
});

document.getElementById('modalConfirm').addEventListener('click', () => {
    hideModal();
    if (modalResolve) modalResolve(true);
});

document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        hideModal();
        if (modalResolve) modalResolve(false);
    }
});

// =============================================
//  РЕНДЕР ТАБЛИЦЫ
// =============================================
function buildCrewOptions(selectedCrewId) {
    let options = '<option value="-1">— Не назначена —</option>';
    state.crews.forEach(crew => {
        const selected = crew.vehicle_number === selectedCrewId ? 'selected' : '';
        options += `<option value="${crew.vehicle_number}" ${selected}>Бригада ${crew.vehicle_number}</option>`;
    });
    return options;
}

function renderTable(employees) {
    const container = document.getElementById('tableBody');

    if (employees.length === 0) {
        container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state__icon">📋</div>
                        <div class="empty-state__title">Сотрудники не найдены</div>
                        <div class="empty-state__desc">Попробуйте обратиться к администратору</div>
                    </div>
                `;
        return;
    }

    let html = `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="checkbox-cell">
                                    <label class="custom-checkbox">
                                        <input type="checkbox" id="selectAll" title="Выбрать всех">
                                        <span class="custom-checkbox__mark"></span>
                                    </label>
                                </th>
                                <th class="sortable" data-sort="id">ID</th>
                                <th class="sortable" data-sort="FIO">ФИО</th>
                                <th class="sortable" data-sort="employee_code">Табельный №</th>
                                <th>Телефон</th>
                                <th>Роль</th>
                                <th>Бригада</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

    employees.forEach((emp, index) => {
        const originalCrew = emp.crews_code ? emp.crews_code != "-1" ? emp.crews_code : -1 : -1;
        const currentCrew = state.pendingChanges[emp._id] !== undefined ?
            state.pendingChanges[emp._id] :
            originalCrew;
        const isChanged = currentCrew !== originalCrew;
        const isAssigned = currentCrew !== null && currentCrew !== -1 && currentCrew !== '';

        const crewSelectClass = isChanged ? 'crew-select has-value changed' :
            isAssigned ? 'crew-select has-value' :
            'crew-select';

        const statusBadge = isAssigned ?
            '<span class="badge badge--success"><span class="badge__dot"></span>В бригаде</span>' :
            '<span class="badge badge--warning"><span class="badge__dot"></span>Не назначен</span>';

        html += `
                    <tr data-id="${emp._id}" style="animation-delay: ${index * 0.04}s">
                        <td class="checkbox-cell">
                            <label class="custom-checkbox">
                                <input type="checkbox" class="row-checkbox" data-id="${emp._id}">
                                <span class="custom-checkbox__mark"></span>
                            </label>
                        </td>
                        <td><strong>${emp._id}</strong></td>
                        <td>
                            <div style="font-weight: 600;">${emp.FIO}</div>
                        </td>
                        <td><code style="background: var(--rt-gray-light); padding: 2px 6px; border-radius: 3px; font-size: 13px;">${emp.employee_code}</code></td>
                        <td style="white-space: nowrap;">${emp.telephone}</td>
                        <td>${getRoleBadge(emp.role)}</td>
                        <td>
                            <div class="crew-select-wrapper">
                                <select class="${crewSelectClass}" data-emp-id="${emp._id}" data-original="${originalCrew}">
                                    ${buildCrewOptions(currentCrew)}
                                </select>
                            </div>
                        </td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Обновляем info
    document.getElementById('tableInfo').textContent =
        `Показано: ${employees.length} из ${state.employees.length}`;

    // Навешиваем обработчики на селекты бригад
    container.querySelectorAll('.crew-select').forEach(select => {
        select.addEventListener('change', handleCrewChange);
    });

    // Навешиваем обработчик на чекбокс «выбрать всех»
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', handleSelectAll);
    }

    // Чекбоксы строк
    container.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectAllState);
    });

    // Сортировка
    container.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });
}

// =============================================
//  ОБРАБОТКА ИЗМЕНЕНИЯ БРИГАДЫ
// =============================================
function handleCrewChange(e) {
    const empId = e.target.dataset.empId;
    const newCrewId = e.target.value ? e.target.value : undefined;
    const originalCrew = state.employees[empId] ? state.employees[empId].crews_code == -1 ? state.employees[empId].crews_code : 0 : 0;

    if (newCrewId === originalCrew || newCrewId === undefined) {
        // Возврат к оригиналу — убираем из pending
        delete state.pendingChanges[empId];
        e.target.classList.remove('changed');
        if (newCrewId) e.target.classList.add('has-value');
        else e.target.classList.remove('has-value');
    } else {
        state.pendingChanges[empId] = newCrewId;
        e.target.classList.add('changed');
        e.target.classList.add('has-value');
    }

    updateChangesBar();
    updateStats();
}

function updateChangesBar() {
    const bar = document.getElementById('changesBar');
    const count = Object.keys(state.pendingChanges).length;

    document.getElementById('changesCount').textContent = count;

    if (count > 0) {
        bar.classList.add('visible');
        document.getElementById('btnSave').disabled = false;
        document.getElementById('btnReset').disabled = false;
    } else {
        bar.classList.remove('visible');
        document.getElementById('btnSave').disabled = true;
        document.getElementById('btnReset').disabled = true;
    }
}

function updateStats() {
    const total = state.employees.length;
    let assigned = 0;

    state.employees.forEach(emp => {
        const crewId = state.pendingChanges[emp._id] !== undefined ?
            state.pendingChanges[emp._id] :
            emp.crewed;
        if (crewId) assigned++;
    });


    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAssigned').textContent = assigned;
    document.getElementById('statCrews').textContent = state.crews.length;
}

// =============================================
//  ВЫБОР ВСЕХ
// =============================================
function handleSelectAll(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = checked;
    });
}

function updateSelectAllState() {
    const all = document.querySelectorAll('.row-checkbox');
    const checked = document.querySelectorAll('.row-checkbox:checked');
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.checked = all.length > 0 && all.length === checked.length;
    }
}

// =============================================
//  СОРТИРОВКА
// =============================================
function handleSort(column) {
    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        state.sortDirection = 'asc';
    }

    // Обновляем визуальное состояние заголовков
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === column) {
            th.classList.add(state.sortDirection);
        }
    });

    applyFiltersAndRender();
}

function sortEmployees(list) {
    if (!state.sortColumn) return list;

    const col = state.sortColumn;
    const dir = state.sortDirection === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });
}

// =============================================
//  ФИЛЬТРАЦИЯ И ПОИСК
// =============================================
function applyFiltersAndRender() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const filterCrew = document.getElementById('filterCrew').value;

    let filtered = state.employees;

    // Поиск
    if (search) {
        filtered = filtered.filter(emp =>
            emp.FIO.toLowerCase().includes(search) ||
            emp.employee_code.includes(search) ||
            emp.telephone.includes(search)
        );
    }

    // Фильтр по бригаде
    if (filterCrew) {
        const crewId = filterCrew;
        filtered = filtered.filter(emp => {
            const currentCrew = state.pendingChanges[emp._id] !== undefined ?
                state.pendingChanges[emp._id] :
                emp.crews_code ? emp.crews_code : -1
            return currentCrew === crewId;
        });
    }

    // Сортировка
    filtered = sortEmployees(filtered);

    state.filteredEmployees = filtered;
    renderTable(filtered);
}

// =============================================
//  СОХРАНЕНИЕ
// =============================================
async function saveChanges() {
    const changes = {...state.pendingChanges
    };
    const entries = Object.entries(changes);

    if (entries.length === 0) {
        showToast('Нет изменений для сохранения', 'info');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const [empId, crewId] of entries) {
        try {
            console.log(crewId);
            let employee = state.employees.find(e => e._id == empId);
            fetch(`${API.setAssignment}/${employee._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    crews_code: crewId,
                })
            });
            employee.crews_code = crewId;

        } catch (error) {
            errorCount++;
            console.error(`Ошибка сохранения для сотрудника ${empId}:`, error);
        }
    }

    // Очищаем pending
    state.pendingChanges = {};

    updateChangesBar();
    updateStats();
    applyFiltersAndRender();

    if (errorCount === 0) {
        showToast(`Успешно сохранено: ${successCount} записей`, 'success');
    } else {
        showToast(`Сохранено: ${successCount}, ошибок: ${errorCount}`, 'error');
    }
}

function resetChanges() {
    state.pendingChanges = {};
    updateChangesBar();
    applyFiltersAndRender();
    showToast('Все изменения отменены', 'info');
}

// =============================================
//  ИНИЦИАЛИЗАЦИЯ
// =============================================
async function setAssignment() {
    let assignments = await fetchJSON(API.originalAssignments);
    for (const index in assignments) {
        let curAssignment = assignments[index];
        state.originalAssignments[curAssignment._id] = curAssignment;
    }
    console.log(state.originalAssignments)
}

async function init() {
    try {
        // Загружаем данные параллельно
        const [employees, crews] = await Promise.all([
            loadEmployees(),
            loadCrews()
        ]);

        state.employees = employees;
        state.crews = crews;

        // Запоминаем начальные привязки
        await setAssignment();
        // Заполняем фильтр бригад
        const filterCrew = document.getElementById('filterCrew');
        crews.forEach(crew => {
            const option = document.createElement('option');
            option.value = crew.vehicle_number;
            option.textContent = `Бригада ${crew.vehicle_number}`;
            filterCrew.appendChild(option);
        });

        // Включаем элементы
        document.getElementById('searchInput').disabled = false;
        document.getElementById('filterCrew').disabled = false;

        // Обновляем статистику
        updateStats();

        // Рендерим таблицу
        applyFiltersAndRender();

        showToast(`Загружено: ${employees.length} сотрудников, ${crews.length} бригад`, 'success');

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

// =============================================
//  ОБРАБОТЧИКИ СОБЫТИЙ
// =============================================
document.getElementById('searchInput').addEventListener('input', () => {
    applyFiltersAndRender();
});

document.getElementById('filterCrew').addEventListener('change', () => {
    applyFiltersAndRender();
});

document.getElementById('btnSave').addEventListener('click', async() => {
    const confirmed = await showModal(
        'Сохранение изменений',
        `Вы уверены, что хотите сохранить <strong>${Object.keys(state.pendingChanges).length}</strong> изменений в распределении сотрудников по бригадам?`
    );
    if (confirmed) {
        await saveChanges();
    }
});

document.getElementById('btnSaveChanges').addEventListener('click', async() => {
    await saveChanges();
});

document.getElementById('btnReset').addEventListener('click', () => {
    resetChanges();
});

document.getElementById('btnCancelChanges').addEventListener('click', () => {
    resetChanges();
});

// Горячие клавиши
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!document.getElementById('btnSave').disabled) {
            document.getElementById('btnSave').click();
        }
    }
    if (e.key === 'Escape') {
        hideModal();
    }
});

// Запуск
init();