function setRoute(addressesByCrews) {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
    ymaps.ready(function() {
        // Если карта уже есть, не создаем новую
        if (myRoutesMap) {
            myRoutesMap.destroy();
        };
        myRoutesMap = new ymaps.Map("mapRoutes", {
            center: [57.201725, 39.440506], // Ростов ул. Северная д.44/2а
            zoom: 15
        });
        let index = 0;
        for (crew in addressesByCrews) {
            const color = colors[(index % colors.length)];
            let multiRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: addressesByCrews[crew],
                params: {
                    results: 1 // Максимальное количество маршрутов
                }
            }, {
                // Внешний вид линий альтернативных маршрутов.
                routeActiveStrokeStyle: 'solid',
                routeActiveStrokeColor: color,
                routeActiveStrokeWidth: 3,
                boundsAutoApply: true
            });
            myRoutesMap.geoObjects.add(multiRoute);
            index++;
        }
    });
}