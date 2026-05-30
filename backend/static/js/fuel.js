const TOTAL_CONSUMPTION = 14.8;

async function init() {
    // ⚠️ Валидный JSON (дубликаты ключей в JSON недопустимы, пример исправлен)
    const rawData = await (await fetch(ORIGIN + "fuel")).json();
    console.log(rawData)
        // {
        //     "к806ро": { "01.02.2025": 118.4, "02.02.2025": 67.5, "05.02.2025": 89.2 },
        //     "к645ро": { "04.02.2025": 81.4, "06.02.2025": 70.1, "08.02.2025": 95.5 },
        //     "к523ро": { "01.02.2025": 81.4, "02.02.2025": 70.1, "03.02.2025": 95.5, "04.02.2025": 97.5 }
        // };

    // 1. Собираем все уникальные даты из всех бригад
    const allDates = new Set();
    Object.values(rawData).forEach(consumption => {
        Object.keys(consumption).forEach(date => allDates.add(date));
    });

    // 2. Сортируем даты по возрастанию (преобразуем DD.MM.YYYY в Date для корректного сравнения)
    const sortedDates = Array.from(allDates).sort((a, b) => {
        const [d1, m1, y1] = a.split('.');
        const [d2, m2, y2] = b.split('.');
        return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
    });

    const container = document.getElementById('chartsContainer');
    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948']; // палитра для графиков

    // 3. Генерируем графики для каждой бригады
    Object.entries(rawData).forEach(([brigadeId, consumptionData], index) => {
        // Создаём карточку и canvas
        const card = document.createElement('div');
        card.className = 'chart-card';
        let consumption_ = 0;
        for (let key in consumptionData) {
            consumption_ += +consumptionData[key];
        }
        const consHeader = document.createElement('p');
        consHeader.classList.add("mt-5", "mb-12", "font-bold")
        consHeader.innerHTML = `Общий километраж: ${consumption_ / TOTAL_CONSUMPTION*100}`;
        const canvas = document.createElement('canvas');
        card.appendChild(canvas);
        container.appendChild(card);
        container.appendChild(consHeader);

        // Маппинг данных на отсортированные даты. 
        // Используем null вместо 0, чтобы Chart.js не соединял точки отсутствующих дней
        const chartData = sortedDates.map(date => consumptionData[date] !== undefined ? consumptionData[date] : null);

        // Инициализация графика
        new Chart(canvas, {
            type: 'bar', // Поменяйте на 'bar', если нужны столбцы
            data: {
                labels: sortedDates,
                datasets: [{
                    label: `Расход топлива`,
                    data: chartData,
                    borderColor: colors[index % colors.length],
                    backgroundColor: colors[index % colors.length] + '33', // 20% opacity
                    borderWidth: 2,
                    tension: 0.2, // сглаживание линий
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: `Бригада: ${brigadeId.toUpperCase()}`, font: { size: 16, weight: 'bold' } },
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.y.toFixed(2)} л`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Расход (л)' },
                        grid: { color: '#eee' }
                    },
                    x: {
                        title: { display: true, text: 'Дата' },
                        grid: { display: false }
                    }
                }
            }
        });
    });
}

init();