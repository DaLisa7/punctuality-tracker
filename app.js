// Application State
let students = [];
let categories = [];
let attendanceData = {};
let currentDate = new Date();
let currentCategory = null;
let autoSaveEnabled = true;
let saveTimeout = null;
let searchTerm = '';
let deferredPrompt = null;

// Initialize App
function init() {
    updateTime();
    setInterval(updateTime, 1000);
    loadConfig();
    loadData();
    updateDateDisplay();
    setDefaultDates();
    renderTrackView();
    refreshReport();
    checkForReminder();
    loadAutoSaveSetting();
    setupPWAInstall();
    registerServiceWorker();
}

// PWA Installation
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner();
    });
}

function showInstallBanner() {
    const banner = document.getElementById('install-banner');
    banner.classList.add('show');
    
    document.getElementById('install-btn').addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                    banner.classList.remove('show');
                }
                deferredPrompt = null;
            });
        }
    });
    
    document.getElementById('close-install').addEventListener('click', () => {
        banner.classList.remove('show');
    });
}

// Register Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered');
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('New version available! Refresh to update.');
                        }
                    });
                });
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    }
}

// Request Notification Permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notifications enabled');
            }
        });
    }
}

// Update Time and Connection Status
function updateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    updateConnectionStatus();
}

function updateConnectionStatus() {
    const status = navigator.onLine ? '📡 Online' : '📴 Offline';
    document.getElementById('connection-status').textContent = status;
}

window.addEventListener('online', () => {
    showToast('Back online! Data will sync.');
    syncData();
});

window.addEventListener('offline', () => {
    showToast('Offline mode - changes saved locally');
});

// Sync Data (for future cloud implementation)
function syncData() {
    // Implement cloud sync here if needed
    console.log('Syncing data...');
}

// Load Configuration
function loadConfig() {
    const savedStudents = localStorage.getItem('students_config');
    if (savedStudents) {
        students = JSON.parse(savedStudents);
    } else {
        students = [];
        for (let i = 1; i <= 10; i++) students.push(`Student ${i}`);
    }

    const savedCategories = localStorage.getItem('categories_config');
    if (savedCategories) {
        categories = JSON.parse(savedCategories);
    } else {
        categories = [
            { name: 'Morning Assembly', time: '6:30 AM', icon: 'sun' },
            { name: 'Breakfast', time: '7:00-8:00 AM', icon: 'utensils' },
            { name: 'Study Time', time: '7:00-9:00 PM', icon: 'book' },
            { name: 'Lights Out', time: '10:00 PM', icon: 'moon' },
            { name: 'Room Cleanliness', time: 'Daily Check', icon: 'broom' }
        ];
    }

    if (categories.length > 0 && !currentCategory) currentCategory = categories[0].name;
    renderConfigUI();
    updateFilters();
    updateLeaderboardCategoryFilter();
}

// Render Configuration UI
function renderConfigUI() {
    const studentList = document.getElementById('student-list');
    if (studentList) {
        studentList.innerHTML = '';
        students.forEach((student, index) => {
            const div = document.createElement('div');
            div.className = 'config-item';
            div.innerHTML = `
                <input type="text" value="${escapeHtml(student)}" onchange="updateStudent(${index}, this.value)">
                <button class="action-btn danger" onclick="removeStudent(${index})" style="padding: 6px 12px;"><i class="fas fa-trash"></i></button>
            `;
            studentList.appendChild(div);
        });
    }

    const categoryList = document.getElementById('category-list');
    if (categoryList) {
        categoryList.innerHTML = '';
        categories.forEach((cat, index) => {
            const div = document.createElement('div');
            div.className = 'config-item';
            div.style.flexWrap = 'wrap';
            div.innerHTML = `
                <input type="text" value="${escapeHtml(cat.name)}" placeholder="Area Name" onchange="updateCategory(${index}, 'name', this.value)" style="flex: 2;">
                <input type="text" value="${escapeHtml(cat.time)}" placeholder="Time" onchange="updateCategory(${index}, 'time', this.value)" style="flex: 1;">
                <input type="text" value="${escapeHtml(cat.icon)}" placeholder="Icon" onchange="updateCategory(${index}, 'icon', this.value)" style="flex: 1;">
                <button class="action-btn danger" onclick="removeCategory(${index})" style="padding: 6px 12px;"><i class="fas fa-trash"></i></button>
            `;
            categoryList.appendChild(div);
        });
    }
}

// Student Management
function updateStudent(index, value) { 
    students[index] = value; 
    saveConfig(); 
    renderTrackView(); 
    refreshReport(); 
    refreshLeaderboard(); 
}

function addStudent() { 
    students.push(`Student ${students.length + 1}`); 
    renderConfigUI(); 
    saveConfig(); 
    renderTrackView(); 
    refreshReport(); 
    showToast('Student added'); 
}

function removeStudent(index) {
    if (confirm('Remove this student?')) {
        const studentName = students[index];
        students.splice(index, 1);
        for (let date in attendanceData) {
            for (let category in attendanceData[date]) {
                delete attendanceData[date][category][studentName];
            }
        }
        renderConfigUI(); 
        saveConfig(); 
        saveData(); 
        renderTrackView(); 
        refreshReport(); 
        refreshLeaderboard(); 
        showToast('Student removed');
    }
}

// Category Management
function updateCategory(index, field, value) { 
    categories[index][field] = value; 
    saveConfig(); 
    renderTrackView(); 
    refreshReport(); 
}

function addCategory() { 
    categories.push({ name: 'New Area', time: 'Time', icon: 'clock' }); 
    if (!currentCategory) currentCategory = categories[0].name; 
    renderConfigUI(); 
    saveConfig(); 
    renderTrackView(); 
    refreshReport(); 
    showToast('Area added'); 
}

function removeCategory(index) {
    if (confirm('Remove this area?')) {
        const removedName = categories[index].name;
        categories.splice(index, 1);
        if (categories.length === 0) categories.push({ name: 'Morning Assembly', time: '6:30 AM', icon: 'sun' });
        if (currentCategory === removedName) currentCategory = categories[0].name;
        for (let date in attendanceData) delete attendanceData[date][removedName];
        renderConfigUI(); 
        saveConfig(); 
        saveData(); 
        renderTrackView(); 
        refreshReport(); 
        refreshLeaderboard(); 
        showToast('Area removed');
    }
}

function saveConfig() { 
    localStorage.setItem('students_config', JSON.stringify(students)); 
    localStorage.setItem('categories_config', JSON.stringify(categories)); 
    updateFilters(); 
    updateLeaderboardCategoryFilter(); 
}

function resetToDefault() {
    if (confirm('Reset to default settings?')) {
        students = []; 
        for (let i = 1; i <= 10; i++) students.push(`Student ${i}`);
        categories = [
            { name: 'Morning Assembly', time: '6:30 AM', icon: 'sun' },
            { name: 'Breakfast', time: '7:00-8:00 AM', icon: 'utensils' },
            { name: 'Study Time', time: '7:00-9:00 PM', icon: 'book' },
            { name: 'Lights Out', time: '10:00 PM', icon: 'moon' },
            { name: 'Room Cleanliness', time: 'Daily Check', icon: 'broom' }
        ];
        currentCategory = categories[0].name;
        saveConfig(); 
        renderConfigUI(); 
        renderTrackView(); 
        refreshReport(); 
        refreshLeaderboard(); 
        showToast('Reset to default');
    }
}

// Export/Import Configuration
function exportConfig() {
    const config = { students, categories, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `punctuality_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported');
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const config = JSON.parse(event.target.result);
                if (config.students) students = config.students;
                if (config.categories) categories = config.categories;
                saveConfig(); 
                renderConfigUI(); 
                renderTrackView(); 
                refreshReport(); 
                refreshLeaderboard(); 
                showToast('Configuration imported');
            } catch (err) { 
                showToast('Invalid config file'); 
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// UI Updates
function updateFilters() {
    const studentFilter = document.getElementById('report-student');
    const categoryFilter = document.getElementById('report-category');
    if (studentFilter) studentFilter.innerHTML = '<option value="">All Students</option>' + students.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (categoryFilter) categoryFilter.innerHTML = '<option value="">All Areas</option>' + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
}

function updateLeaderboardCategoryFilter() {
    const filter = document.getElementById('leaderboard-category');
    if (filter) filter.innerHTML = '<option value="">All Areas</option>' + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
}

function renderTrackView() { 
    renderCategoryGrid(); 
    renderStudentsList(); 
    updateDailyStats(); 
}

function renderCategoryGrid() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = '';
    categories.forEach(cat => {
        const chip = document.createElement('button');
        chip.className = `category-chip ${currentCategory === cat.name ? 'active' : ''}`;
        chip.onclick = () => { currentCategory = cat.name; renderTrackView(); };
        chip.innerHTML = `<i class="fas fa-${cat.icon || 'clock'}"></i> ${escapeHtml(cat.name)}`;
        grid.appendChild(chip);
    });
}

function filterStudents() {
    searchTerm = document.getElementById('student-search')?.value.toLowerCase() || '';
    renderStudentsList();
}

function renderStudentsList() {
    const container = document.getElementById('students-container');
    if (!container) return;
    const dateKey = currentDate.toDateString();
    if (!attendanceData[dateKey]) attendanceData[dateKey] = {};
    if (!attendanceData[dateKey][currentCategory]) attendanceData[dateKey][currentCategory] = {};
    
    const filteredStudents = students.filter(s => s.toLowerCase().includes(searchTerm));
    container.innerHTML = '';
    
    filteredStudents.forEach(student => {
        const data = attendanceData[dateKey][currentCategory][student] || { status: '', remarks: '' };
        const percentage = getStudentAttendancePercentage(student, currentCategory);
        const row = document.createElement('div');
        row.className = 'student-item';
        row.innerHTML = `
            <div class="student-name">
                ${escapeHtml(student)}
                <span class="student-percentage">(${percentage}%)</span>
            </div>
            <div class="status-group">
                <div class="status-option on-time ${data.status === 'On Time' ? 'selected' : ''}" onclick="setStatus('${escapeHtml(student)}', 'On Time')">✓ On Time</div>
                <div class="status-option late ${data.status === 'Late' ? 'selected' : ''}" onclick="setStatus('${escapeHtml(student)}', 'Late')">⏰ Late</div>
                <div class="status-option absent ${data.status === 'Absent' ? 'selected' : ''}" onclick="setStatus('${escapeHtml(student)}', 'Absent')">✗ Absent</div>
            </div>
            <input type="text" class="remarks-field" placeholder="Remarks" value="${escapeHtml(data.remarks || '')}" onchange="setRemarks('${escapeHtml(student)}', this.value)">
        `;
        container.appendChild(row);
    });
}

function getStudentAttendancePercentage(student, category = null) {
    let records = getAllRecords().filter(r => r.student === student);
    if (category) records = records.filter(r => r.category === category);
    if (records.length === 0) return 0;
    const onTimeCount = records.filter(r => r.status === 'On Time').length;
    return Math.round((onTimeCount / records.length) * 100);
}

function updateDailyStats() {
    const dateKey = currentDate.toDateString();
    const categoryData = attendanceData[dateKey]?.[currentCategory] || {};
    let onTime = 0, late = 0, absent = 0;
    
    students.forEach(student => {
        const status = categoryData[student]?.status;
        if (status === 'On Time') onTime++;
        else if (status === 'Late') late++;
        else if (status === 'Absent') absent++;
    });
    
    const total = onTime + late + absent;
    const attendanceRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
    
    document.getElementById('daily-on-time').textContent = onTime;
    document.getElementById('daily-late').textContent = late;
    document.getElementById('daily-absent').textContent = absent;
    document.getElementById('daily-attendance').textContent = `${attendanceRate}%`;
}

function setStatus(student, status) {
    const dateKey = currentDate.toDateString();
    if (!attendanceData[dateKey]) attendanceData[dateKey] = {};
    if (!attendanceData[dateKey][currentCategory]) attendanceData[dateKey][currentCategory] = {};
    if (!attendanceData[dateKey][currentCategory][student]) attendanceData[dateKey][currentCategory][student] = {};
    attendanceData[dateKey][currentCategory][student].status = status;
    renderStudentsList();
    updateDailyStats();
    if (autoSaveEnabled) debouncedSave();
}

function setRemarks(student, remarks) {
    const dateKey = currentDate.toDateString();
    if (!attendanceData[dateKey]) attendanceData[dateKey] = {};
    if (!attendanceData[dateKey][currentCategory]) attendanceData[dateKey][currentCategory] = {};
    if (!attendanceData[dateKey][currentCategory][student]) attendanceData[dateKey][currentCategory][student] = {};
    attendanceData[dateKey][currentCategory][student].remarks = remarks;
    if (autoSaveEnabled) debouncedSave();
}

function setStatusForAll(status) { 
    students.forEach(student => setStatus(student, status)); 
    showToast(`All marked as ${status}`);
    if (autoSaveEnabled) debouncedSave();
}

function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveData();
        showAutoSaveIndicator();
    }, 1500);
}

function saveDataOnly() {
    saveData();
    refreshReport();
    showToast('✅ Records saved');
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('auto-save-indicator');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
}

function clearCurrentDay() {
    if (confirm('Clear all selections for today? This will NOT delete saved records.')) {
        const dateKey = currentDate.toDateString();
        if (attendanceData[dateKey] && attendanceData[dateKey][currentCategory]) {
            attendanceData[dateKey][currentCategory] = {};
        }
        renderStudentsList();
        updateDailyStats();
        showToast('All selections cleared');
    }
}

function changeDate(days) {
    if (days === 0) currentDate = new Date();
    else currentDate.setDate(currentDate.getDate() + days);
    updateDateDisplay();
    renderStudentsList();
    updateDailyStats();
}

function updateDateDisplay() { 
    document.getElementById('date-display').textContent = currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); 
}

function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput) endInput.value = endDate.toISOString().split('T')[0];
}

// Data Persistence
function loadData() { 
    const saved = localStorage.getItem('attendanceData'); 
    if (saved) attendanceData = JSON.parse(saved); 
}

function saveData() { 
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData)); 
}

function getAllRecords() {
    const records = [];
    for (const [date, categoriesData] of Object.entries(attendanceData)) {
        for (const [category, studentsData] of Object.entries(categoriesData)) {
            for (const [student, data] of Object.entries(studentsData)) {
                if (data.status) {
                    records.push({
                        date: new Date(date).toLocaleDateString(),
                        rawDate: date,
                        student: student,
                        category: category,
                        status: data.status,
                        remarks: data.remarks || ''
                    });
                }
            }
        }
    }
    return records.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
}

// Leaderboard
function refreshLeaderboard() {
    const categoryFilter = document.getElementById('leaderboard-category')?.value || '';
    const period = document.getElementById('leaderboard-period')?.value;
    let records = getAllRecords();
    
    if (categoryFilter) records = records.filter(r => r.category === categoryFilter);
    if (period !== 'all') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
        records = records.filter(r => new Date(r.rawDate) >= cutoffDate);
    }
    
    const scores = {};
    records.forEach(record => {
        if (!scores[record.student]) scores[record.student] = { total: 0, onTime: 0, late: 0, absent: 0 };
        scores[record.student].total++;
        if (record.status === 'On Time') {
            scores[record.student].onTime++;
        } else if (record.status === 'Late') {
            scores[record.student].late++;
        } else if (record.status === 'Absent') {
            scores[record.student].absent++;
        }
    });
    
    const leaderboard = Object.entries(scores).map(([name, stats]) => ({
        name,
        score: (stats.onTime * 3 + stats.late * 1) / stats.total,
        onTime: stats.onTime,
        late: stats.late,
        absent: stats.absent,
        total: stats.total,
        percentage: Math.round((stats.onTime / stats.total) * 100)
    })).sort((a, b) => b.score - a.score);
    
    renderLeaderboard(leaderboard);
    renderStudentRankings(leaderboard);
}

function renderLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    container.innerHTML = '<h4>🏆 Top Performers</h4>';
    leaderboard.slice(0, 10).forEach((student, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
        container.innerHTML += `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${medal}</div>
                <div class="leaderboard-name">${escapeHtml(student.name)}</div>
                <div class="leaderboard-score">${student.percentage}% (${student.onTime}/${student.total})</div>
            </div>
        `;
    });
}

function renderStudentRankings(leaderboard) {
    const container = document.getElementById('student-rankings');
    if (!container) return;
    container.innerHTML = '<h4>📊 Individual Statistics</h4>';
    leaderboard.forEach(student => {
        container.innerHTML += `
            <div class="leaderboard-item">
                <div class="leaderboard-name">${escapeHtml(student.name)}</div>
                <div class="leaderboard-score">✅ ${student.onTime} | ⏰ ${student.late} | ❌ ${student.absent}</div>
                <div class="leaderboard-score">📈 ${student.percentage}%</div>
            </div>
        `;
    });
}

// Reports
function refreshReport() {
    const records = getAllRecords();
    const studentFilter = document.getElementById('report-student')?.value || '';
    const categoryFilter = document.getElementById('report-category')?.value || '';
    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';
    let filtered = records;
    if (studentFilter) filtered = filtered.filter(r => r.student === studentFilter);
    if (categoryFilter) filtered = filtered.filter(r => r.category === categoryFilter);
    if (startDate) filtered = filtered.filter(r => new Date(r.rawDate) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(r => new Date(r.rawDate) <= new Date(endDate));
    renderReportTable(filtered);
    renderStats(filtered);
}

function renderReportTable(records) {
    const tbody = document.getElementById('report-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (records.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">📊 No records found</td></tr>'; 
        return; 
    }
    records.slice(0, 500).forEach(record => {
        const statusColor = record.status === 'On Time' ? '#4caf50' : record.status === 'Late' ? '#ff9800' : '#f44336';
        tbody.innerHTML += `
            <tr>
                <td style="white-space: nowrap;">${escapeHtml(record.date)}</td>
                <td><strong>${escapeHtml(record.student)}</strong></td>
                <td>${escapeHtml(record.category)}</td>
                <td><span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; display: inline-block;">${escapeHtml(record.status)}</span></td>
                <td>${escapeHtml(record.remarks)}</td>
            </tr>
        `;
    });
}

function renderStats(records) {
    const total = records.length;
    const onTime = records.filter(r => r.status === 'On Time').length;
    const late = records.filter(r => r.status === 'Late').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card"><i class="fas fa-chart-line"></i><div class="stat-value">${total}</div><div class="stat-label">Total Records</div></div>
        <div class="stat-card"><i class="fas fa-check-circle"></i><div class="stat-value">${onTime}</div><div class="stat-label">On Time (${total ? Math.round(onTime/total*100) : 0}%)</div></div>
        <div class="stat-card"><i class="fas fa-clock"></i><div class="stat-value">${late}</div><div class="stat-label">Late (${total ? Math.round(late/total*100) : 0}%)</div></div>
        <div class="stat-card"><i class="fas fa-times-circle"></i><div class="stat-value">${absent}</div><div class="stat-label">Absent (${total ? Math.round(absent/total*100) : 0}%)</div></div>
    `;
}

function generatePDFReport() {
    showToast('📄 PDF generation ready - use browser print (Ctrl+P)');
    window.print();
}

function showClearReportsModal() { 
    document.getElementById('modal').classList.add('active'); 
}

function closeModal() { 
    document.getElementById('modal').classList.remove('active'); 
}

function clearAllReports() { 
    attendanceData = {}; 
    saveData(); 
    refreshReport(); 
    refreshLeaderboard(); 
    closeModal(); 
    showToast('All reports cleared'); 
}

// Export Functions
function exportToCSV(records, filename) {
    const headers = ['Date', 'Student', 'Area', 'Status', 'Remarks'];
    const csvRows = [headers.join(',')];
    records.forEach(r => csvRows.push(`"${r.date}","${r.student}","${r.category}","${r.status}","${r.remarks}"`));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${records.length} records`);
}

function exportDailyCSV() { 
    const records = getAllRecords().filter(r => r.date === currentDate.toLocaleDateString()); 
    if (records.length === 0) { 
        showToast('No records for today'); 
        return; 
    } 
    exportToCSV(records, `punctuality_${currentDate.toISOString().split('T')[0]}`); 
}

function exportFilteredCSV() {
    const records = getAllRecords();
    const studentFilter = document.getElementById('report-student')?.value || '';
    const categoryFilter = document.getElementById('report-category')?.value || '';
    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';
    let filtered = records;
    if (studentFilter) filtered = filtered.filter(r => r.student === studentFilter);
    if (categoryFilter) filtered = filtered.filter(r => r.category === categoryFilter);
    if (startDate) filtered = filtered.filter(r => new Date(r.rawDate) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(r => new Date(r.rawDate) <= new Date(endDate));
    if (filtered.length === 0) { 
        showToast('No records match filters'); 
        return; 
    }
    exportToCSV(filtered, 'punctuality_filtered');
}

// Settings
function toggleAutoSave() {
    autoSaveEnabled = document.getElementById('auto-save-toggle').checked;
    localStorage.setItem('auto_save_enabled', autoSaveEnabled);
    showToast(autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled');
}

function loadAutoSaveSetting() {
    const saved = localStorage.getItem('auto_save_enabled');
    if (saved !== null) autoSaveEnabled = saved === 'true';
    const toggle = document.getElementById('auto-save-toggle');
    if (toggle) toggle.checked = autoSaveEnabled;
}

function setReminder() {
    const time = document.getElementById('reminder-time').value;
    if (time) {
        localStorage.setItem('reminder_time', time);
        showToast(`Reminder set for ${time}`);
        checkForReminder();
    }
}

function checkForReminder() {
    const savedTime = localStorage.getItem('reminder_time');
    if (savedTime && Notification.permission === 'granted') {
        const now = new Date();
        const reminderTime = new Date();
        const [hours, minutes] = savedTime.split(':');
        reminderTime.setHours(hours, minutes, 0);
        if (now > reminderTime) reminderTime.setDate(reminderTime.getDate() + 1);
        const timeUntil = reminderTime - now;
        setTimeout(() => {
            new Notification('Punctuality Tracker', { 
                body: 'Time to mark attendance!', 
                icon: 'icons/icon-192x192.png' 
            });
        }, timeUntil);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// Utility Functions
function escapeHtml(text) { 
    if (!text) return ''; 
    const div = document.createElement('div'); 
    div.textContent = text; 
    return div.innerHTML; 
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}-tab`).style.display = 'block';
    event.target.classList.add('active');
    if (tab === 'reports') refreshReport();
    if (tab === 'leaderboard') refreshLeaderboard();
    if (tab === 'track') renderTrackView();
}

function showToast(message) { 
    const toast = document.getElementById('toast'); 
    toast.textContent = message; 
    toast.classList.add('show'); 
    setTimeout(() => toast.classList.remove('show'), 2000); 
}

// Initialize App
init();