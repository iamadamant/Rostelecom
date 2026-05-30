if (!ORIGIN) {
    let ORIGIN = 'https://rostelecom-production.up.railway.app/';
}

async function generateHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');

    return hashHex;
}
// Логика модального окна
async function toggleModal(modalID, id = -1, address = '', coords = [57.201725, 39.440506], crews_id = '', priority = 0) {
    const modal = document.getElementById(modalID);
    modal.classList.toggle('hidden');
    document.getElementById('address').value = "";
    document.getElementById('queue').value = 0;
    document.querySelector('#brigade').value = 0;
    if (id == -1) {
        document.getElementById('route-id').value = -1;
    }

    // Если открываем модалку, инициализируем карту (если еще не инициализирована)
    if (!modal.classList.contains('hidden')) {
        document.getElementById("brigade").innerHTML = await getBrigades();
        initMap(coords);
        if (address == '') return;
        document.getElementById('address').value = address;
        document.getElementById('queue').value = priority;
        document.querySelector('#brigade').value = crews_id;
        document.getElementById('route-id').value = id;
        console.log(id);
    }
}

async function modifyEntityModal(modalID, id, address = '', coords = [57.201725, 39.440506], crews_id = '', priority = 0) {
    const modal = document.getElementById(modalID);
    modal.classList.toggle('hidden');
    document.getElementById('address').value = "";
    document.getElementById('queue').value = 0;
    document.querySelector('#brigade').value = 0;

    // Если открываем модалку, инициализируем карту (если еще не инициализирована)
    if (!modal.classList.contains('hidden')) {
        document.getElementById("brigade").innerHTML = await getBrigades();
        initMap(coords);
        if (address == '') return;
        document.getElementById('address').value = address;
        document.getElementById('queue').value = priority;
        document.querySelector('#brigade').value = crews_id;
        document.getElementById('route-id').value = id;
    }
    document.getElementById('wrong-data').classList.add("hidden");
    document.getElementById('right-data').classList.add("hidden");
}


async function deleteRoute(id) {
    let sure = confirm("Вы уверены, что хотите удалить запись? Востановление невозможно!");
    if (sure) {
        let req = await fetch(ORIGIN + `routes/${id}`, {
            method: "DELETE"
        });
    }
    renderTable();
}

// Логика формы
async function submitForm(e) {
    e.preventDefault();
    // Сбор данных
    let id = document.getElementById('route-id').value;
    const formData = {
        address: document.getElementById('address').value,
        priority: document.getElementById('queue').value,
        crews_code: document.getElementById('brigade').value,
        coordinates: document.getElementById('coords').value,
    };
    console.log(formData)
    let response;
    if (id != -1) {
        response = await fetch(ORIGIN + `routes/${id}`, {
            method: 'PUT', // Specify the method
            headers: {
                'Content-Type': 'application/json' // Inform the server of the data format
            },
            body: JSON.stringify(formData)
        });
    } else {
        response = await fetch(ORIGIN + 'routes', {
            method: 'POST', // Specify the method
            headers: {
                'Content-Type': 'application/json' // Inform the server of the data format
            },
            body: JSON.stringify(formData)
        });
    }
    if (response.status == 200) {
        document.getElementById('right-data').classList.toggle("hidden");
        renderTable();
    }
    if (response.status == 400) {
        document.getElementById('wrong-data').classList.toggle("hidden");
    }
}

// Логика Яндекс Карт
let myMap;
let myRoutesMap;
let myPlacemark;

function initMap(coordinates = [57.201725, 39.440506]) {
    // Проверяем, загружен ли API
    if (!ymaps) return;

    ymaps.ready(function() {
        // Если карта уже есть, не создаем новую
        if (myMap) {
            myMap.setCenter(coordinates);
            return;
        };

        myMap = new ymaps.Map("map", {
            center: coordinates, // Ростов ул. Северная д.44/2а
            zoom: 15
        });

        // Обработчик клика по карте
        myMap.events.add('click', function(e) {
            var coords = e.get('coords');

            // Если метка уже существует, просто перемещаем её
            if (myPlacemark) {
                myPlacemark.geometry.setCoordinates(coords);
            } else {
                // Создаем метку
                myPlacemark = new ymaps.Placemark(coords, {
                    hintContent: 'Новый адрес',
                    balloonContent: 'Выбранный адрес'
                }, {
                    preset: 'islands#blueIcon'
                });
                myMap.geoObjects.add(myPlacemark);
            }

            // Получаем адрес по координатам (геокодинг)
            ymaps.geocode(coords).then(function(res) {
                var firstGeoObject = res.geoObjects.get(0);
                // Вставляем адрес в инпут
                console.log(firstGeoObject.getAddressLine())
                document.getElementById('address').value = firstGeoObject.getAddressLine();
                document.getElementById('coords').value = coords;
            });
        });
    });
}

async function getBrigades() {
    let brigs = (await fetch(ORIGIN + "crews"));
    brigs = await brigs.json();
    let res = `<option value="" disabled selected>Выберите бригаду</option>`;
    brigs.forEach(element => {
        res += `<option value=${element.vehicle_number}>${element.vehicle_number}</option>`
    });
    return res;
}