const API_BASE = '/api/domains';

// DOM Elements
const domainsTableBody = document.getElementById('domainsTableBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Modal Elements
const domainModal = document.getElementById('domainModal');
const modalTitle = document.getElementById('modalTitle');
const domainForm = document.getElementById('domainForm');
const fieldId = document.getElementById('domainId');
const fieldName = document.getElementById('domainName');
const fieldUrl = document.getElementById('domainUrl');

// Stats Elements
const statTotal = document.getElementById('totalDomains');
const statUp = document.getElementById('totalUp');
const statDown = document.getElementById('totalDown');
const statAvgLatency = document.getElementById('avgLatency');

// State
let allDomains = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchDomains();

    // Refresh data every 10 seconds
    setInterval(fetchDomains, 10000);

    // Search listener
    searchInput.addEventListener('input', (e) => {
        renderDomains(e.target.value);
    });
});

// Fetch data
async function fetchDomains() {
    try {
        const response = await fetch(API_BASE);
        if (response.status === 401) {
            // Unauthorized, redirect to login
            window.location.href = '/login';
            return;
        }
        if (!response.ok) throw new Error('Failed to fetch data');

        allDomains = await response.json();

        // Hide loading after first fetch
        loadingIndicator.classList.add('hidden');

        updateStats();
        renderDomains(searchInput.value);
    } catch (error) {
        console.error('Error fetching domains:', error);
        showToast('Error', 'Failed to connect to the backend server.', 'error');
    }
}

// Render Table
function renderDomains(filterText = '') {
    domainsTableBody.innerHTML = '';

    let filteredDomains = allDomains;
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredDomains = allDomains.filter(d =>
            d.name.toLowerCase().includes(lowerFilter) ||
            d.url.toLowerCase().includes(lowerFilter)
        );
    }

    if (filteredDomains.length === 0) {
        if (!filterText && allDomains.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            // No matches for search
            emptyState.classList.add('hidden');
            domainsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No domains match your search.</td></tr>`;
        }
        return;
    }

    emptyState.classList.add('hidden');

    filteredDomains.forEach(domain => {
        const tr = document.createElement('tr');

        // Status calculations
        const statusClass = domain.status.toLowerCase();

        // Uptime styling
        let uptimeFillClass = '';
        if (domain.uptime_percentage < 90) uptimeFillClass = 'danger';
        else if (domain.uptime_percentage < 99) uptimeFillClass = 'warning';

        // Format date
        const dateChecked = domain.last_checked ? new Date(domain.last_checked).toLocaleString() : 'Pending...';

        tr.innerHTML = `
            <td>
                <div class="domain-name">${escapeHTML(domain.name)}</div>
            </td>
            <td>
                <div class="domain-url">
                    <a href="${escapeHTML(domain.url)}" target="_blank">${escapeHTML(domain.url)}</a>
                    <a href="${escapeHTML(domain.url)}" target="_blank" title="Open in new tab"><i class="fa-solid fa-external-link-alt" style="font-size: 10px;"></i></a>
                </div>
            </td>
            <td>
                <div class="badge ${statusClass}">${domain.status}</div>
            </td>
            <td>
                <div class="latency-display">${domain.latency} ms</div>
            </td>
            <td>
                <div class="uptime-text">${domain.uptime_percentage}%</div>
                <div class="uptime-bar">
                    <div class="uptime-fill ${uptimeFillClass}" style="width: ${domain.uptime_percentage}%"></div>
                </div>
            </td>
            <td>
                <div class="last-checked">${dateChecked}</div>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon edit" onclick='openEditModal(${JSON.stringify(domain).replace(/'/g, "&#39;")})' title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteDomain('${domain.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        domainsTableBody.appendChild(tr);
    });
}

// Update Header Stats
function updateStats() {
    statTotal.textContent = allDomains.length;
    statUp.textContent = allDomains.filter(d => d.status === 'UP').length;
    statDown.textContent = allDomains.filter(d => d.status === 'DOWN').length;

    // Average Latency
    if (allDomains.length > 0) {
        const total = allDomains.reduce((sum, d) => sum + d.latency, 0);
        const avg = Math.round(total / allDomains.length);
        statAvgLatency.innerHTML = `${avg}<span style="font-size:16px; margin-left:4px; color:var(--text-muted)">ms</span>`;
    } else {
        statAvgLatency.innerHTML = `0<span style="font-size:16px; margin-left:4px; color:var(--text-muted)">ms</span>`;
    }
}

// Authentication
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) {
        console.error("Logout failed", e);
    }
}

// Modal Logic
function openAddModal() {
    modalTitle.textContent = 'Add Domain';
    domainForm.reset();
    fieldId.value = '';
    domainModal.classList.remove('hidden');
    fieldName.focus();
}

function openEditModal(domain) {
    modalTitle.textContent = 'Edit Domain';
    fieldId.value = domain.id;
    fieldName.value = domain.name;
    fieldUrl.value = domain.url;
    domainModal.classList.remove('hidden');
    fieldName.focus();
}

function closeModal() {
    domainModal.classList.add('hidden');
}

// Close explicitly on backdrop click
domainModal.addEventListener('click', (e) => {
    if (e.target === domainModal) {
        closeModal();
    }
});

// Form Submit (Add / Edit)
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = fieldId.value;
    const isEdit = !!id;

    const payload = {
        name: fieldName.value.trim(),
        url: fieldUrl.value.trim()
    };

    try {
        let response;
        if (isEdit) {
            response = await fetch(`${API_BASE}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save');
        }

        showToast('Success', `Domain ${isEdit ? 'updated' : 'added'} successfully.`, 'success');
        closeModal();
        fetchDomains(); // Refresh UI instantly

    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

// Delete Domain
async function deleteDomain(id) {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete domain');

        showToast('Success', 'Domain deleted.', 'success');
        fetchDomains();
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

// Toast Notifications
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
