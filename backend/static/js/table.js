if (!ORIGIN) {
    let ORIGIN = 'https://rostelecom-production.up.railway.app/';
}

if (document.cookie.search("user") == -1) {
    document.location = '/index.html';
}

// Mock Routing Data
// Status Badge Configuration
const statusConfig = {
    active: {
        class: 'bg-green-100 text-green-800',
        label: 'Активен'
    },
    pending: {
        class: 'bg-yellow-100 text-yellow-800',
        label: 'Ожидает'
    },
    inactive: {
        class: 'bg-gray-100 text-gray-800',
        label: 'Неактивен'
    }
};

function compare(firstRoute, secondRoute) {
    if (firstRoute.crews_code > secondRoute.crews_code) {
        return 1;
    } else if (firstRoute.crews_code < secondRoute.crews_code) {
        return -1;
    } else {
        return firstRoute.priority - secondRoute.priority;
    }
}

function getFullPathLength(points) {
    const startPoint = [57.201725, 39.440506];
    points.push(startPoint);
    let length = 0;
    ymaps.ready(() => {
        for (let i = 0; i < points.length - 1; i++) {
            length += ymaps.coordSystem.geo.getDistance(points[i], points[i + 1]);
        }
        document.getElementById("length-shower").innerHTML = `Общая длина маршрута: ${(length/1000).toFixed(2)} км`;
    });
}

// Render Table
async function renderTable() {
    let btn = document.getElementById('refresh-button');
    document.getElementById("empty-ways").classList.add("hidden");
    btn.innerHTML = "Обновляем..."
    setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 20 20" class="size-5 fill-current">
                            <path d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" fill-rule="evenodd" clip-rule="evenodd"></path>
                        </svg>
                        Обновить`;
    }, 2000);
    let token = document.cookie.split("=")[1];
    let req = await fetch(ORIGIN + 'routes', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    let waited_req = await fetch(ORIGIN + 'count/closed_routes');

    let routes = [];
    if (req.status != 400) {
        routes = await req.json();
    }

    routes.sort(compare);

    // Обновить счетчики
    if (waited_req.status == 200) {
        let answ = await waited_req.json();
        document.getElementById("waiting-points").innerHTML = answ.count;
    }
    document.getElementById("all-points").innerHTML = routes.length;
    document.getElementById("appointed-points").innerHTML = routes.length;
    const tbody = document.getElementById('route-table-body');
    tbody.innerHTML = '';
    let routePoints = {};
    let routePointslength = [
        [57.201725, 39.440506]
    ];

    const modify = req.headers.get('x-user-mode') == "modify";

    const close_way = req.headers.get('x-user-mode') == "submit";

    let crewsLink = document.getElementById('crews-link');

    if (routes.length == 0) {
        document.getElementById("empty-ways").classList.remove("hidden");
    }

    routes.forEach(route => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        if (routePoints[route.crews_code]) {
            routePoints[route.crews_code].push(route.address);
        } else {
            routePoints[route.crews_code] = [route.address]
        }
        let coord = route.coordinates.split(",");
        routePointslength.push([+coord[0], +coord[1]]);
        const status = statusConfig["active"];

        tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${route._id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-clip">${route.address}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">${route.priority}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">${route.coordinates}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">${route.crews_code}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}">
                            ${status.label}
                        </span>
                    </td>
                `;
        if (modify) {
            tr.innerHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="flex items-center gap-2">
                            <button class="text-blue-600 hover:text-blue-800 font-medium" title="Редактировать" onclick="toggleModal('addressModal', '${route._id}', '${route.address}', [${route.coordinates}], '${route.crews_code}', ${route.priority})">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                            </button>
                            <button class="text-red-600 hover:text-red-800 font-medium" title="Удалить" onclick="deleteRoute('${route._id}')">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </td>`
        }
        tbody.appendChild(tr);

        ymaps.ready(() => {
            for (let i = 0; i < routes.length - 1; i++) {
                let firstPoints = routes[i].coordinates.split(',');
                let secondPoints = routes[i + 1].coordinates.split(',');
                let length = ymaps.coordSystem.geo.getDistance(
                    [+firstPoints[0], +firstPoints[1]], [+secondPoints[0], +secondPoints[1]]
                );
                routes[i].length = length;
            }
            let endPoint = [57.201725, 39.440506];
            let lastPoint = routes[routes.length - 1].coordinates.split(',');
            routes[routes.length - 1].length = ymaps.coordSystem.geo.getDistance(
                [+lastPoint[0], +lastPoint[1]], endPoint
            )
            localStorage.setItem('routes', JSON.stringify(routes));
        });

    });
    if (!modify) {
        let addBtn = document.getElementById("add-button");
        addBtn.disabled = true;
        addBtn.style = "background-color: gray";
        getFullPathLength(routePointslength);
        crewsLink.innerHTML = "Бригада";
        crewsLink.href = "brigade.html";
    } else {
        document.getElementById("apply-link").classList.toggle("hidden");
    }
    if (close_way) {
        document.getElementById("close-way").classList.toggle("hidden");
    }
    setRoute(routePoints);
}

async function setRouteToApprove() {
    let routes = JSON.parse(localStorage.getItem("routes"));

    response = await fetch(ORIGIN + 'many/closed_routes', {
        method: 'POST', // Specify the method
        headers: {
            'Content-Type': 'application/json' // Inform the server of the data format
        },
        body: JSON.stringify(routes)
    });
    if (response.status == 200) {
        await renderTable();
    }
}

function filterTable(searchText) {
    const tbody = document.getElementById('route-table-body');
    if (!tbody) return;

    const rows = tbody.getElementsByTagName('tr');
    const query = searchText.trim().toLowerCase();

    for (let row of rows) {
        // Получаем весь текст внутри строки (включая все колонки)
        const rowText = row.textContent.toLowerCase();

        if (query === '' || rowText.includes(query)) {
            row.style.display = ''; // показываем строку
        } else {
            row.style.display = 'none'; // скрываем строку
        }
    }
}

// Logout Handler
function logout() {
    document.cookie = "user=; max-age=-1;";
    document.location = "/";
}

// Initialize
renderTable();