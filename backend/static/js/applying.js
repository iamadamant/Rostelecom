let crewRoutes;
let ymapsReady = false;
let cardMaps = {};
let modalMapInstance = null;
let changedRoutes = null;

function compare(firstRoute, secondRoute) {
    if (firstRoute.crews_code > secondRoute.crews_code) {
        return 1;
    } else if (firstRoute.crews_code < secondRoute.crews_code) {
        return -1;
    } else {
        return firstRoute.priority - secondRoute.priority;
    }
}

// Group routes by crew
function groupByCrew(data) {
    const groups = {};
    data.sort(compare);
    data.forEach(route => {
        const crewId = route.crews_code;
        if (!groups[crewId]) {
            groups[crewId] = {
                crews_code: crewId,
                vehicle_number: route.vehicle_number,
                routes: [],
                totalLength: 0,
                maxPriority: route.priority,
                status: 'pending'
            };
        }
        groups[crewId].routes.push(route);
        groups[crewId].totalLength += +route.length;
        if (route.priority < groups[crewId].maxPriority) {
            groups[crewId].maxPriority = route.priority;
        }
    });
    let routesByGroup = Object.values(groups);
    localStorage.setItem("routesByGroup", JSON.stringify(routesByGroup));
    return routesByGroup;
}

// Render cards
function renderCards(filter = 'all') {
    const grid = document.getElementById('routesGrid');
    grid.innerHTML = '';

    let filtered = crewRoutes;
    if (filter === 'pending') filtered = crewRoutes.filter(c => c.status === 'pending');
    else if (filter === 'confirmed') filtered = crewRoutes.filter(c => c.status === 'confirmed');
    else if (filter === 'rejected') filtered = crewRoutes.filter(c => c.status === 'rejected');

    if (filtered.length === 0) {
        grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                        </svg>
                        <h3>Нет маршрутов</h3>
                        <p>По выбранному фильтру маршруты не найдены</p>
                    </div>
                `;
        return;
    }

    filtered.forEach((crew, index) => {
        const card = document.createElement('div');
        card.className = `route-card ${crew.status !== 'pending' ? crew.status : ''}`;
        card.setAttribute('data-crew-id', crew.crews_code);
        card.style.animationDelay = `${index * 0.08}s`;

        const priorityLabel = crew.maxPriority === 1 ? 'Высокий' : crew.maxPriority === 2 ? 'Средний' : 'Низкий';
        const priorityClass = `p${crew.maxPriority}`;

        const statusBadge = crew.status !== 'pending' ?
            `<div class="card-status-badge ${crew.status}">${crew.status === 'confirmed' ? '✓ Подтверждён' : '✕ Отклонён'}</div>` :
            '';

        card.innerHTML = `
                    ${statusBadge}
                    <div class="card-map" id="cardMap_${crew.crews_code}">
                        <div class="map-loading" id="loading_${crew.crews_code}">
                            <div class="spinner"></div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="card-crew-info">
                            <div class="crew-badge">
                                <div class="crew-avatar">${crew.crews_code}</div>
                                <div class="crew-details">
                                    <h3>Бригада ${crew.crews_code}</h3>
                                    <p>${crew.routes.length} точек маршрута</p>
                                </div>
                            </div>
                            <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
                        </div>
                        <div class="card-address">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F58220" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span>${crew.routes[0].address}</span>
                        </div>
                        <div class="card-meta">
                            <div class="meta-item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                                ${(crew.totalLength/1000).toFixed(2)} км
                            </div>
                            <div class="meta-item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ${crew.routes.length} адресов
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-confirm" onclick="event.stopPropagation(); confirmRoute('${crew.crews_code}')" ${crew.status !== 'pending' ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Подтвердить
                            </button>
                            <button class="btn btn-reject" onclick="event.stopPropagation(); rejectRoute('${crew.crews_code}')" ${crew.status !== 'pending' ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                Отклонить
                            </button>
                        </div>
                    </div>
                `;

        card.addEventListener('click', () => openModal(crew.crews_code));
        grid.appendChild(card);
    });
}

// Initialize mini maps on cards
function initCardMaps() {
    if (!ymapsReady) return;

    crewRoutes.forEach(crew => {
        const container = document.getElementById(`cardMap_${crew.crews_code}`);
        if (!container) return;

        const coords = crew.routes.map(r => {
            const [lat, lng] = r.coordinates.split(',').map(Number);
            return [lat, lng];
        });

        try {
            const map = new ymaps.Map(`cardMap_${crew.crews_code}`, {
                center: coords[0],
                zoom: 13,
                controls: []
            }, {
                suppressMapOpeners: true
            });

            map.behaviors.disable(['scrollZoom', 'drag', 'dblClickZoom']);

            // Draw route polyline
            const polyline = new ymaps.Polyline(coords, {}, {
                strokeColor: '#F58220',
                strokeWidth: 0,
                strokeStyle: 'solid'
            });
            map.geoObjects.add(polyline);

            // Add markers
            coords.forEach((coord, idx) => {
                const isStart = idx === 0;
                const isEnd = idx === coords.length - 1;
                const markerColor = isStart ? '#16A34A' : (isEnd ? '#DC2626' : '#F58220');

                const marker = new ymaps.Placemark(coord, {
                    iconContent: String(idx + 1)
                }, {
                    preset: 'islands#darkOrangeCircleIcon',
                    iconColor: markerColor
                });
                map.geoObjects.add(marker);
            });

            // Fit map to show all points
            map.setBounds(polyline.geometry.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 30
            });

            // Remove loading spinner
            const loading = document.getElementById(`loading_${crew.crews_code}`);
            if (loading) loading.style.display = 'none';

            cardMaps[crew.crews_code] = map;
        } catch (e) {
            console.error('Error creating map for crew', crew.crews_code, e);
            const loading = document.getElementById(`loading_${crew.crews_code}`);
            if (loading) loading.innerHTML = '<span style="font-size:12px;color:#999">Карта недоступна</span>';
        }
    });
}

// Open modal
function openModal(crewId) {
    const crew = crewRoutes.find(c => c.crews_code === crewId);
    if (!crew) return;

    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = `Маршрут бригады ${crew.crews_code}`;

    // Info grid
    const infoGrid = document.getElementById('modalInfoGrid');
    const priorityLabel = crew.maxPriority === 1 ? 'Высокий' : crew.maxPriority === 2 ? 'Средний' : 'Низкий';
    const statusText = crew.status === 'confirmed' ? 'Подтверждён' : crew.status === 'rejected' ? 'Отклонён' : 'Ожидает подтверждения';
    infoGrid.innerHTML = `
                <div class="info-item">
                    <div class="info-label">Бригада / ТС</div>
                    <div class="info-value">Бригада ${crew.crews_code}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Общая длина</div>
                    <div class="info-value">${(crew.totalLength/1000).toFixed(2)} км</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Приоритет</div>
                    <div class="info-value">${priorityLabel}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Статус</div>
                    <div class="info-value">${statusText}</div>
                </div>
            `;

    // Route points list
    const pointList = document.getElementById('routePointList');
    pointList.innerHTML = '';
    crew.routes.forEach((route, idx) => {
        const isLast = idx === crew.routes.length - 1;
        const item = document.createElement('div');
        item.className = 'route-point-item';
        item.innerHTML = `
                    <div class="point-line-wrapper">
                        <div class="point-dot"></div>
                        ${!isLast ? '<div class="point-connector"></div>' : ''}
                    </div>
                    <div class="point-content">
                        <div class="point-address">${route.address}</div>
                        <div class="point-meta">
                            <span>Приоритет: ${route.priority === 1 ? 'Высокий' : route.priority === 2 ? 'Средний' : 'Низкий'}</span>
                            <span>Длина: ${(+(route.length)/1000).toFixed(2)} км</span>
                        </div>
                    </div>
                `;
        pointList.appendChild(item);
    });

    // Modal actions
    const actions = document.getElementById('modalActions');
    const isDisabled = crew.status !== 'pending';
    actions.innerHTML = `
                <button class="btn btn-confirm" onclick="confirmRoute('${crew.crews_code}'); closeModal();" ${isDisabled ? 'disabled' : ''}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Подтвердить маршрут
                </button>
                <button class="btn btn-reject" onclick="rejectRoute('${crew.crews_code}'); closeModal();" ${isDisabled ? 'disabled' : ''}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Отклонить маршрут
                </button>
            `;

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Initialize modal map
    setTimeout(() => {
        initModalMap(crew);
    }, 100);
}

function initModalMap(crew) {
    const container = document.getElementById('modalMap');
    container.innerHTML = '';

    const coords = crew.routes.map(r => {
        const [lat, lng] = r.coordinates.split(',').map(Number);
        return [lat, lng];
    });

    try {
        modalMapInstance = new ymaps.Map('modalMap', {
            center: coords[0],
            zoom: 13,
            controls: ['zoomControl', 'geolocationControl']
        });

        const polyline = new ymaps.Polyline(coords, {}, {
            strokeColor: '#F58220',
            strokeWidth: 5,
            strokeStyle: 'solid'
        });
        modalMapInstance.geoObjects.add(polyline);

        coords.forEach((coord, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === coords.length - 1;
            const markerColor = isStart ? '#16A34A' : (isEnd ? '#DC2626' : '#F58220');

            const marker = new ymaps.Placemark(coord, {
                iconContent: String(idx + 1),
                balloonContentHeader: `Точка ${idx + 1}`,
                balloonContentBody: crew.routes[idx].address
            }, {
                preset: 'islands#darkOrangeCircleIcon',
                iconColor: markerColor
            });
            modalMapInstance.geoObjects.add(marker);
        });

        modalMapInstance.setBounds(polyline.geometry.getBounds(), {
            checkZoomRange: true,
            zoomMargin: 50
        });
    } catch (e) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">Карта недоступна</div>';
    }
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    if (modalMapInstance) {
        modalMapInstance.destroy();
        modalMapInstance = null;
    }
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Confirm route
async function confirmRoute(crewId) {
    const crew = crewRoutes.find(c => c.crews_code === crewId);
    if (!crew || crew.status !== 'pending') return;
    crew.status = 'confirmed';
    updateStats();
    renderCards(getCurrentFilter());
    if (ymapsReady) initCardMaps();
    showToast('Маршрут подтверждён', 'success');
    let idArray = [];
    let groupedRoutes = crewRoutes.filter(e => e.crews_code == crewId);
    if (groupedRoutes.length > 0) {
        groupedRoutes[0]["routes"].forEach(e => idArray.push(e));
    }
    changedRoutes["applied"].push(idArray);
}

// Reject route
function rejectRoute(crewId) {
    const crew = crewRoutes.find(c => c.crews_code === crewId);
    if (!crew || crew.status !== 'pending') return;
    crew.status = 'rejected';
    updateStats();
    renderCards(getCurrentFilter());
    if (ymapsReady) initCardMaps();
    showToast('Маршрут отклонён', 'error');
    let groupedRoutes = crewRoutes.filter(e => e.crews_code == crewId);
    changedRoutes["canceled"].push(groupedRoutes[0]["routes"]);
}

async function saveChanges() {
    let applied = changedRoutes["applied"];
    let canceled = changedRoutes["canceled"];
    applied.forEach(async(element) => {
        let response = await fetch('http://127.0.0.1:8000/many/closed_routes', {
            method: 'DELETE', // Specify the method
            headers: {
                'Content-Type': 'application/json' // Inform the server of the data format
            },
            body: JSON.stringify(element)
        });
    });

    canceled.forEach(async(element) => {
        let response = await fetch('http://127.0.0.1:8000/many/routes', {
            method: 'POST', // Specify the method
            headers: {
                'Content-Type': 'application/json' // Inform the server of the data format
            },
            body: JSON.stringify(element)
        });
    });

    setTimeout(() => init(), 500);
}

function getCurrentFilter() {
    const active = document.querySelector('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
}

function updateStats() {
    const total = crewRoutes.length;
    const confirmed = crewRoutes.filter(c => c.status === 'confirmed').length;
    const rejected = crewRoutes.filter(c => c.status === 'rejected').length;
    const pending = total - confirmed - rejected;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statRejected').textContent = rejected;
    document.getElementById('statPending').textContent = pending;
    if (confirmed > 0 || rejected > 0) {
        document.getElementById('changesBar').classList.remove("hidden");
    }
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCards(btn.dataset.filter);
        if (ymapsReady) {
            setTimeout(() => initCardMaps(), 50);
        }
    });
});

// Toast notification
function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    ${type === 'success' 
                        ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' 
                        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                </svg>
                ${message}
            `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// If ymaps doesn't load, still render cards (without maps)
setTimeout(() => {
    if (!ymapsReady) {
        ymapsReady = true;
        renderCards();
        // Try to show a message that maps aren't available
        crewRoutes.forEach(crew => {
            const loading = document.getElementById(`loading_${crew.crews_code}`);
            if (loading) {
                loading.innerHTML = '<span style="font-size:12px;color:#999;">Яндекс.Карты не загрузились</span>';
            }
        });
    }
}, 5000);

async function init() {
    changedRoutes = {
        "applied": [],
        "canceled": []
    }
    document.getElementById('changesBar').classList.add("hidden");
    res = await fetch("http://localhost:8000/closed_routes");
    routesData = await res.json();
    crewRoutes = groupByCrew(routesData);
    console.log(crewRoutes);
    // Initialize Yandex Maps
    ymaps.ready(function() {
        ymapsReady = true;
        renderCards();
        initCardMaps();
        updateStats();
    });
}

init();