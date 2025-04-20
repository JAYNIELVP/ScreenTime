let isLoading = true;
let consumptionChart;
let timeChart;
let config;
let data;

var loader = document.getElementById("loader");
var loaderText = document.getElementById("loaderText");

function toggleLoader(type){
    if(type == 0) {
        if(!isLoading) return;

        isLoading = false;
        loader.style.opacity = 0;

        setTimeout(function() { loader.style.display = "none"; }, 1010);
    } else {
        if(type == 1){
            loaderText.innerText = "LOADING";
        }

        if(isLoading) return;

        isLoading = true;
        loader.style.display = "flex";
        setTimeout(function() { loader.style.opacity = 1; }, 10);
    }
}

var popup = document.getElementById("popup");
var popupTitle = document.getElementById("popupTitle");
var popupDesc = document.getElementById("popupDesc");
var popupBtns = document.getElementById("popupBtns");

function openPopup(args){
    popupTitle.innerText = args.title;
    popupDesc.innerText = args.desc;
    
    if(args.btns != null){
        popupBtns.innerHTML = '';
        popupBtns.style.gridTemplateColumns = `repeat(${args.btns.length}, 1fr)`;

        args.btns.forEach(btn => {
            const button = document.createElement('button');

            button.textContent = btn.text;
            button.onclick = new Function('event', `return ${btn.func}`);
            popupBtns.appendChild(button);
        });
    }

    popup.style.display = "flex";
    setTimeout(function() { popup.style.opacity = 1; }, 10);
}

function closePopup(){
    popup.style.opacity = 0;
    setTimeout(function() { 
        popup.style.display = "none"; 
        popupBtns.innerHTML = '';
    }, 1010);
}

function getData(type) {
    const array = [];

    if(type === 'labels') {
        for(const d in data) {
            array.push(data[d].date);
        }
    } else if(type === 'total-time') {
        for(const d in data) {
            const time = Math.round((data[d].time / 3600) * 100) / 100;
            array.push(time);
        }
    } else if(type === 'real-time') {
        for(const d in data) {
            const time = Math.round((data[d].realTime / 3600) * 100) / 100;
            array.push(time);
        }
    } else if(type === 'average-time') {
        const totalTime = getData('total-time');
        const realTime = getData('real-time');

        for(let i = 0; i < totalTime.length; i++) {
            const average = Math.round(((totalTime[i] + realTime[i]) / 2) * 100) / 100;
            array.push(average);
        }
    } else if(type === 'consumption') {
        const totalTime = getData('total-time');

        for(const t of totalTime) {
            const consumption = Math.round((config.consumption * t / 1000) * 100) / 100;
            array.push(consumption);
        }
    } else if(type === 'cost') {
        const consumption = getData('consumption');

        for(const c of consumption) {
            const cost = Math.round((config.cost * c) * 100) / 100;
            array.push(cost);
        }
    }

    return array;
}

function drawCharts() {
    if(timeChart) timeChart.destroy();
    if(consumptionChart) consumptionChart.destroy();

    const timectx = document.getElementById('time-chart').getContext('2d');
    const consumptionctx = document.getElementById('consumption-chart').getContext('2d');

    const timeData = {
        labels: getData('labels'),
        datasets: [
            {
                label: 'Total Time',
                data: getData('total-time'),
                borderColor: '#1ABC9C',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            },
            {
                label: 'Real Time',
                data: getData('real-time'),
                borderColor: '#57F287',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            },
            {
                label: 'Average Time',
                data: getData('average-time'),
                borderColor: '#3498DB',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            }
        ]
    };

    const consumptionData = {
        labels: getData('labels'),
        datasets: [
            {
                label: 'Consumption',
                data: getData('consumption'),
                backgroundColor: 'rgba(230, 126, 34, 0.2)',
                borderColor: 'rgba(230, 126, 34, 1)',
                borderWidth: 1
            },
            {
                label: 'Cost',
                data: getData('cost'),
                backgroundColor: 'rgba(237, 66, 69, 0.2)',
                borderColor: 'rgba(237, 66, 69, 1)',
                borderWidth: 1
            },
        ]
    };

    const timeConfig = {
        type: 'line',
        data: timeData,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (hours)'
                    }
                }
            }
        }
    };

    const consumptionConfig = {
        type: 'bar',
        data: consumptionData,
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Consumption (kWh) and Cost ($)'
                    }
                }
            }
        }
    };

    timeChart = new Chart(timectx, timeConfig);
    consumptionChart = new Chart(consumptionctx, consumptionConfig);

    toggleLoader(0);
}

function init() {
    document.getElementById('consumption').value = config.consumption.toString();
    document.getElementById('cost').value = config.cost.toString();
    document.getElementById('data-path').value = config.data;
}

function changePath() {
    window.electronAPI.sendMessage('change-path');
}

function exportConfig() {
    window.electronAPI.sendMessage('export-config');
}

function deleteConfig() {
    openPopup({
        title: 'Delete Configuration',
        desc: 'Are you sure you want to delete the configuration?\nIt will reset all settings to default and restart the app.',
        btns: [
            { 
                text: 'Cancel', 
                func: 'closePopup()' 
            },
            { 
                text: 'Yes', 
                func: "window.electronAPI.sendMessage('delete-config')"
            }
        ]
    });
}

function saveConfig() {
    const consumption = document.getElementById('consumption').value;
    const cost = document.getElementById('cost').value;

    if(consumption == 0) {
        openPopup({ 
            title: 'Invalid Consumption', 
            desc: 'Consumption cannot be 0.', 
            btns: [{text: 'OK', func: 'closePopup()'}]  
        });
    } else if(cost == 0) {
        openPopup({ 
            title: 'Invalid Cost', 
            desc: 'Cost cannot be 0.', 
            btns: [{text: 'OK', func: 'closePopup()'}]  
        });
    } else {
        window.electronAPI.sendMessage({command: 'save-config', consumption: parseFloat(consumption), cost: parseFloat(cost)});
    }
}

document.getElementById('consumption').addEventListener('input', () => { 
    const numericValue = document.getElementById('consumption').value.replace(/[^0-9.]/g, '');
    document.getElementById('consumption').value = numericValue;
});

document.getElementById('cost').addEventListener('input', () => { 
    const numericValue = document.getElementById('cost').value.replace(/[^0-9.]/g, '');
    document.getElementById('cost').value = numericValue;
});


window.electronAPI.sendMessage('ready');
window.electronAPI.onMessage((event, message) => {
    if(message.command == 'init') {
        config = message.config;
        data = message.data;

        init();
    } else if(message == 'draw-charts') {
        drawCharts();
    } else if(message == 'path-changed') {
        openPopup({ 
            title: 'Path Changed', 
            desc: 'The data path has been changed successfully.', 
            btns: [{text: 'OK', func: 'closePopup()'}]  
        });
    } else if(message == 'config-exported') {
        openPopup({ 
            title: 'Configuration Exported',
            desc: 'The configuration file has been exported successfully.',
            btns: [{text: 'OK', func: 'closePopup()'}]  
        });
    } else if(message == 'config-saved') {
        openPopup({ 
            title: 'Configuration Saved', 
            desc: 'The configuration has been saved successfully.', 
            btns: [{text: 'OK', func: 'closePopup()'}] 
        });
    }
});