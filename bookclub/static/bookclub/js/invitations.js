// Invitations Page JavaScript

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1090';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toastId = 'toast-' + Date.now();
    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
    const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';

    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${iconClass} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    toast.show();

    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

/**
 * Copy invitation link to clipboard with toast notification
 */
function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(
        function() {
            showToast('Invitation link copied to clipboard!', 'success');
        },
        function() {
            showToast('Failed to copy invitation link. Please try again.', 'error');
        }
    );
}

// Expose functions globally
window.copyInviteLink = copyInviteLink;
window.showToast = showToast;
