let suspend = false;
let stopped = false;
let isLocked = false;
let startTime;
let suspendTime;
let realTime = 0;
let powerConsumption = 30;
let config;
let data;

function updateTime() {
    const currentTime = new Date();
    const elapsedTime = currentTime - startTime;
    const formattedTime = new Date(elapsedTime).toISOString().substr(11, 8);

    document.getElementById('time').innerText = formattedTime;
}

function updateRealTime(time) {
    if (stopped || suspend) return;

    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = time % 60;
    const formattedTime = [hours, minutes, seconds]
        .map(unit => unit < 10 ? '0' + unit : unit)
        .join(':');
    
    realTime = time;
    document.getElementById('real-time').innerText = formattedTime;
}

function updateConsumption() {
    const elapsedTime = new Date() - startTime;
    const consumption = powerConsumption * (elapsedTime / 3600e3) / 1000;

    document.getElementById('consumption').innerText = `${consumption.toFixed(2)} kWh`;
}

function main () {
    if (stopped) return;

    if (!suspend) {
        setTimeout(updateTime, 1000);
        setTimeout(updateConsumption, 1000);
    }

    setTimeout(main, 1000);
}

function toggleDrag() {
    if (isLocked) {
        document.body.style['-webkit-app-region'] = 'no-drag';
    } else {
        document.body.style['-webkit-app-region'] = 'drag';
    }
}

function toggleLock() {
    isLocked = !isLocked;

    document.getElementById('lock').style.fill = isLocked ? 'white' : '#888888';
    document.getElementById('lock-button').title = isLocked ? 'Unlock Position' : 'Lock Position';
    window.electronAPI.sendMessage({command: 'lock', state: isLocked});

    toggleDrag();
}

function saveData() {
    const data = {
        date: new Date().toLocaleDateString(),
        time: Math.floor((new Date() - startTime) / 1000),
        realTime: realTime
    };

    window.electronAPI.sendMessage({command: 'save', data: data});
}

function autoSave() {
    if (stopped) return;

    if (!suspend) {
        saveData();
    }

    setTimeout(autoSave, 60e3);
}

function init() {
    startTime = data ? new Date() - data.time * 1000 : new Date();
    realTime = data ? data.realTime : 0
    isLocked = config.locked;
    powerConsumption = config.consumption;

    document.getElementById('lock').style.fill = isLocked ? 'white' : '#888888';
    document.getElementById('lock-button').title = isLocked ? 'Unlock Position' : 'Lock Position';

    toggleDrag();
    autoSave();
    main();
}

function openSettings() {
    window.electronAPI.sendMessage('open-settings');
}

window.electronAPI.onMessage((event, message) => {
    if(message.command == 'init') {
        config = message.config;
        data = message.data;
        
        init();
    } else if(message.command == 'real-time') {
        updateRealTime(message.time);
    } else if(message == 'suspend') {
        suspendTime = new Date();
        suspend = true;

        setTimeout(saveData, 1000);
    } else if (message == 'resume') {
        startTime = new Date() - ((new Date() - startTime) - (new Date() - suspendTime));
        suspend = false;
    } else if(message == 'shutdown') {
        shutdown = true;
        setTimeout(saveData, 1000);
    }
});