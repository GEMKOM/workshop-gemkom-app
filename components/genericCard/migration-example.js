// Migration example: Converting finished timers to use GenericCard
// This shows how to replace the existing timer card implementation

import { GenericCard, createCardGrid } from './genericCard.js';

// Example: Convert a timer object to GenericCard format
function convertTimerToCardData(timer) {
    const startTime = new Date(timer.start_time).toLocaleString('tr-TR');
    const finishTime = new Date(timer.finish_time).toLocaleString('tr-TR');
    const duration = calculateDuration(timer.start_time, timer.finish_time);
    
    return {
        title: timer.issue_key || 'Bilinmeyen İş',
        subtitle: timer.issue_name || 'Açıklama yok',
        icon: 'fas fa-check-circle',
        iconColor: '#28a745',
        iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
        status: 'Tamamlandı',
        statusType: 'success',
        details: [
            { icon: 'fas fa-cog', label: 'Makine:', value: timer.machine_name || 'Bilinmeyen' },
            { icon: 'fas fa-user', label: 'Kullanıcı:', value: timer.username || 'Bilinmeyen' },
            { icon: 'fas fa-play', label: 'Başlangıç:', value: startTime },
            { icon: 'fas fa-stop', label: 'Bitiş:', value: finishTime },
            { icon: 'fas fa-clock', label: 'Süre:', value: duration, valueClass: 'duration' },
            { icon: 'fas fa-hashtag', label: 'İş Emri:', value: timer.job_no || '-' }
        ],
        buttons: [
            { 
                text: 'Detaylar', 
                icon: 'fas fa-eye', 
                class: 'btn-outline-primary', 
                onClick: () => showTimerDetails(timer) 
            },
            { 
                text: 'Rapor', 
                icon: 'fas fa-file-pdf', 
                class: 'btn-outline-success', 
                onClick: () => generateTimerReport(timer) 
            }
        ]
    };
}

// Example: Render timers using GenericCard
function renderTimersWithGenericCard(timers, containerId) {
    const container = document.getElementById(containerId);
    
    // Convert timers to card data
    const cardsData = timers.map(convertTimerToCardData);
    
    // Create card grid
    createCardGrid(container, cardsData, {
        columns: 1,
        gap: '1rem',
        className: 'timers-grid'
    });
}

// Example: Render individual timer card
function renderSingleTimerCard(timer, containerId) {
    const container = document.getElementById(containerId);
    const cardData = convertTimerToCardData(timer);
    
    new GenericCard(container, cardData);
}

// Example: Machine card conversion
function convertMachineToCardData(machine) {
    let status = 'Çalışır Durumda';
    let statusType = 'success';
    let icon = 'fas fa-check-circle';
    let iconColor = '#28a745';
    let iconBackground = 'linear-gradient(135deg, #28a745, #20c997)';
    
    if (machine.is_under_maintenance) {
        status = 'Bakımda';
        statusType = 'warning';
        icon = 'fas fa-tools';
        iconColor = '#ffc107';
        iconBackground = 'linear-gradient(135deg, #ffc107, #e0a800)';
    } else if (machine.has_active_timer) {
        status = 'Kullanımda';
        statusType = 'info';
        icon = 'fas fa-play-circle';
        iconColor = '#007bff';
        iconBackground = 'linear-gradient(135deg, #007bff, #0056b3)';
    }
    
    return {
        title: machine.name || `Makine ${machine.id}`,
        subtitle: machine.machine_type_label || machine.machine_type || 'Makine',
        icon: icon,
        iconColor: iconColor,
        iconBackground: iconBackground,
        status: status,
        statusType: statusType,
        details: [
            { icon: 'fas fa-map-marker-alt', label: 'Konum:', value: machine.location || 'Belirtilmemiş' },
            { icon: 'fas fa-calendar', label: 'Son Bakım:', value: machine.last_maintenance || 'Bilinmiyor' },
            { icon: 'fas fa-clock', label: 'Çalışma Saati:', value: machine.working_hours || '0 saat' }
        ],
        buttons: [
            { 
                text: 'Detaylar', 
                icon: 'fas fa-info', 
                class: 'btn-outline-primary', 
                onClick: () => showMachineDetails(machine) 
            }
        ],
        clickable: true,
        onClick: () => selectMachine(machine)
    };
}

// Example: User card conversion
function convertUserToCardData(user) {
    const isActive = user.is_active || false;
    
    return {
        title: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
        subtitle: user.role || 'Kullanıcı',
        icon: isActive ? 'fas fa-user' : 'fas fa-user-slash',
        iconColor: isActive ? '#28a745' : '#6c757d',
        iconBackground: isActive ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #6c757d, #495057)',
        status: isActive ? 'Aktif' : 'Çevrimdışı',
        statusType: isActive ? 'success' : 'info',
        details: [
            { icon: 'fas fa-envelope', label: 'Email:', value: user.email || 'Belirtilmemiş' },
            { icon: 'fas fa-phone', label: 'Telefon:', value: user.phone || 'Belirtilmemiş' },
            { icon: 'fas fa-calendar', label: 'Son Giriş:', value: user.last_login || 'Bilinmiyor' }
        ],
        buttons: [
            { 
                text: 'Mesaj Gönder', 
                icon: 'fas fa-envelope', 
                class: 'btn-outline-primary', 
                onClick: () => sendMessage(user) 
            }
        ]
    };
}

// Utility function for duration calculation (same as in finishedTimers.js)
function calculateDuration(startTime, finishTime) {
    const start = new Date(startTime);
    const finish = new Date(finishTime);
    const diff = finish - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}s ${minutes}dk`;
    } else {
        return `${minutes}dk`;
    }
}

// Example event handlers (implement these based on your needs)
function showTimerDetails(timer) {
    console.log('Showing timer details:', timer);
    // Implement timer details modal or navigation
}

function generateTimerReport(timer) {
    console.log('Generating report for timer:', timer);
    // Implement report generation
}

function showMachineDetails(machine) {
    console.log('Showing machine details:', machine);
    // Implement machine details modal or navigation
}

function selectMachine(machine) {
    console.log('Selecting machine:', machine);
    // Implement machine selection logic
}

function sendMessage(user) {
    console.log('Sending message to user:', user);
    // Implement message sending
}

// Export functions for use in other modules
export {
    convertTimerToCardData,
    renderTimersWithGenericCard,
    renderSingleTimerCard,
    convertMachineToCardData,
    convertUserToCardData
};
