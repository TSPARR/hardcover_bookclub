/**
 * Toast Notification Utility
 * Provides accessible, Bootstrap 5-based toast notifications
 */

/**
 * Show a toast notification
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {string} title - Toast title
 * @param {string} message - Toast message body
 * @param {number} duration - Auto-hide duration in milliseconds (default: 5000, 0 = no auto-hide)
 * @returns {HTMLElement} The toast element
 */
export function showToast(type, title, message, duration = 5000) {
    // Get or create toast container
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    // Icon mapping for different toast types
    const iconMap = {
        'success': 'bi-check-circle-fill',
        'error': 'bi-exclamation-circle-fill',
        'warning': 'bi-exclamation-triangle-fill',
        'info': 'bi-info-circle-fill'
    };

    const icon = iconMap[type] || iconMap['info'];
    const toastClass = `toast-${type}`;

    // Create toast element
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast = document.createElement('div');
    toast.className = `toast ${toastClass}`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    if (duration > 0) {
        toast.setAttribute('data-bs-autohide', 'true');
        toast.setAttribute('data-bs-delay', duration.toString());
    } else {
        toast.setAttribute('data-bs-autohide', 'false');
    }

    // Build toast HTML
    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi ${icon}"></i>
            <strong class="me-auto">${escapeHtml(title)}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${escapeHtml(message)}
        </div>
    `;

    // Add to container
    container.appendChild(toast);

    // Initialize and show toast using Bootstrap
    const bsToast = new window.bootstrap.Toast(toast);
    bsToast.show();

    // Remove from DOM after hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });

    return toast;
}

/**
 * Show a success toast
 * @param {string} title - Toast title
 * @param {string} message - Toast message body
 * @param {number} duration - Auto-hide duration in milliseconds (default: 5000)
 */
export function showSuccessToast(title, message, duration = 5000) {
    return showToast('success', title, message, duration);
}

/**
 * Show an error toast
 * @param {string} title - Toast title
 * @param {string} message - Toast message body
 * @param {number} duration - Auto-hide duration in milliseconds (default: 0 = no auto-hide)
 */
export function showErrorToast(title, message, duration = 0) {
    return showToast('error', title, message, duration);
}

/**
 * Show a warning toast
 * @param {string} title - Toast title
 * @param {string} message - Toast message body
 * @param {number} duration - Auto-hide duration in milliseconds (default: 7000)
 */
export function showWarningToast(title, message, duration = 7000) {
    return showToast('warning', title, message, duration);
}

/**
 * Show an info toast
 * @param {string} title - Toast title
 * @param {string} message - Toast message body
 * @param {number} duration - Auto-hide duration in milliseconds (default: 5000)
 */
export function showInfoToast(title, message, duration = 5000) {
    return showToast('info', title, message, duration);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
    const container = document.getElementById('toast-container');
    if (container) {
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => {
            const bsToast = window.bootstrap.Toast.getInstance(toast);
            if (bsToast) {
                bsToast.hide();
            }
        });
    }
}

// Make available globally for inline usage if needed
if (typeof window !== 'undefined') {
    window.showToast = showToast;
    window.showSuccessToast = showSuccessToast;
    window.showErrorToast = showErrorToast;
    window.showWarningToast = showWarningToast;
    window.showInfoToast = showInfoToast;
    window.clearAllToasts = clearAllToasts;
}
