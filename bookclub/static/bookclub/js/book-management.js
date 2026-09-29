/**
 * Book management functionality for book clubs
 */

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all book management features
    initBookReordering();
    initBookAttribution();
    initAddBookForm();
    initConfirmationModal();
    initProgressBars();
    initTooltips();
});

// Initialize book reordering functionality
function initBookReordering() {
    const reorderButtons = document.querySelectorAll('.btn-reorder');

    reorderButtons.forEach(button => {
        button.addEventListener('click', function() {
            const bookId = this.getAttribute('data-book-id');
            const direction = this.getAttribute('data-direction');

            // Get group ID from URL
            const pathParts = window.location.pathname.split('/');
            const groupId = pathParts[pathParts.indexOf('groups') + 1];

            // Disable button while processing
            this.disabled = true;

            // Get CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            // Make AJAX request
            fetch(`/groups/${groupId}/books/${bookId}/reorder/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `direction=${direction}`
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Reload page to show new order
                    window.location.reload();
                } else {
                    alert('Error reordering book: ' + (data.error || 'Unknown error'));
                    this.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while reordering the book.');
                this.disabled = false;
            });
        });
    });
}

// Initialize book attribution functionality
function initBookAttribution() {
    // Handle attribution modal
    const attributionButtons = document.querySelectorAll('.edit-attribution');
    if (!attributionButtons.length) return;
    
    attributionButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const bookId = this.getAttribute('data-book-id');
            const bookTitle = this.getAttribute('data-book-title');
            const pickedBy = this.getAttribute('data-picked-by');
            const isCollective = this.getAttribute('data-collective') === 'true';
            
            const attributionBookId = document.getElementById('attributionBookId');
            const attributionBookTitle = document.getElementById('attributionBookTitle');
            const pickedBySelect = document.getElementById('pickedBy');
            const collectiveCheck = document.getElementById('isCollectivePick');
            
            if (attributionBookId) attributionBookId.value = bookId;
            if (attributionBookTitle) attributionBookTitle.textContent = bookTitle;
            
            if (pickedBySelect) {
                if (pickedBy) {
                    pickedBySelect.value = pickedBy;
                } else {
                    pickedBySelect.value = '';
                }
            }
            
            if (collectiveCheck) {
                collectiveCheck.checked = isCollective;
                // Toggle visibility of picked by section based on collective pick checkbox
                togglePickedBySection(isCollective);
            }
        });
    });
    
    // Toggle picked by section when collective pick checkbox changes
    const collectiveCheckbox = document.getElementById('isCollectivePick');
    if (collectiveCheckbox) {
        collectiveCheckbox.addEventListener('change', function() {
            togglePickedBySection(this.checked);
        });
    }
}

// Toggle picked by section visibility
function togglePickedBySection(isCollective) {
    const pickedBySection = document.getElementById('pickedBySection');
    if (!pickedBySection) return;
    
    if (isCollective) {
        pickedBySection.style.display = 'none';
        
        const pickedBySelect = document.getElementById('pickedBy');
        if (pickedBySelect) {
            pickedBySelect.value = '';
        }
    } else {
        pickedBySection.style.display = 'block';
    }
}

// Initialize add book form functionality
function initAddBookForm() {
    // Toggle picked by section when collective pick checkbox changes
    const collectiveCheck = document.getElementById('id_is_collective_pick');
    if (collectiveCheck) {
        collectiveCheck.addEventListener('change', function() {
            const pickedBySection = document.getElementById('pickedBySection');
            if (pickedBySection) {
                pickedBySection.style.display = this.checked ? 'none' : 'block';
                
                // Clear selection if collective is checked
                if (this.checked) {
                    const pickedBySelect = document.getElementById('id_picked_by');
                    if (pickedBySelect) {
                        pickedBySelect.value = '';
                    }
                }
            }
        });
    }
    
    // Handle "Set as active book" checkbox if present
    const setActiveCheck = document.getElementById('id_set_active');
    const setActiveSection = document.getElementById('setActiveSection');
    
    if (setActiveCheck && setActiveSection) {
        // Initially show/hide based on checkbox state
        setActiveSection.style.display = setActiveCheck.checked ? 'block' : 'none';
        
        // Add change handler
        setActiveCheck.addEventListener('change', function() {
            setActiveSection.style.display = this.checked ? 'block' : 'none';
        });
    }
}

// Initialize confirmation modal for destructive actions
function initConfirmationModal() {
    const confirmationModal = document.getElementById('confirmationModal');
    if (!confirmationModal) return;

    const modal = new bootstrap.Modal(confirmationModal);
    const confirmButton = document.getElementById('confirmationModalConfirm');
    const messageElement = document.getElementById('confirmationModalMessage');

    let currentAction = null;
    let currentForm = null;

    // Helper function to show confirmation modal
    function showConfirmation(message, action, form = null) {
        messageElement.textContent = message;
        currentAction = action;
        currentForm = form;
        modal.show();
    }

    // Handle remove book actions from dropdown
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-book-action') ||
            e.target.closest('.remove-book-action')) {
            e.preventDefault();
            const button = e.target.classList.contains('remove-book-action') ?
                          e.target : e.target.closest('.remove-book-action');
            const bookId = button.getAttribute('data-book-id');
            const groupId = button.getAttribute('data-group-id');

            showConfirmation(
                'Are you sure you want to remove this book? This action cannot be undone.',
                () => {
                    // Create and submit form
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = `/groups/${groupId}/books/${bookId}/remove/`;

                    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                    const csrfInput = document.createElement('input');
                    csrfInput.type = 'hidden';
                    csrfInput.name = 'csrfmiddlewaretoken';
                    csrfInput.value = csrfToken;
                    form.appendChild(csrfInput);

                    document.body.appendChild(form);
                    form.submit();
                }
            );
        }
    });

    // Handle refresh book actions from dropdown
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('refresh-book-action') ||
            e.target.closest('.refresh-book-action')) {
            e.preventDefault();
            const button = e.target.classList.contains('refresh-book-action') ?
                          e.target : e.target.closest('.refresh-book-action');
            const bookId = button.getAttribute('data-book-id');

            showConfirmation(
                'Are you sure you want to refresh book details from Hardcover? This will update the book information.',
                () => {
                    // Create and submit form
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = `/book/${bookId}/refresh`;

                    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                    const csrfInput = document.createElement('input');
                    csrfInput.type = 'hidden';
                    csrfInput.name = 'csrfmiddlewaretoken';
                    csrfInput.value = csrfToken;
                    form.appendChild(csrfInput);

                    document.body.appendChild(form);
                    form.submit();
                }
            );
        }
    });

    // Intercept forms with confirmation class
    document.addEventListener('submit', function(e) {
        const form = e.target;

        // Check if form or submit button has data-confirm attribute
        const submitButton = e.submitter;
        const confirmMessage = submitButton?.getAttribute('data-confirm') ||
                             form.getAttribute('data-confirm');

        if (confirmMessage && !form.hasAttribute('data-confirmed')) {
            e.preventDefault();
            showConfirmation(confirmMessage, null, form);
        }
    });

    // Handle confirmation button click
    confirmButton.addEventListener('click', function() {
        if (currentAction) {
            currentAction();
            currentAction = null;
        } else if (currentForm) {
            // Mark form as confirmed to bypass the confirmation check
            currentForm.setAttribute('data-confirmed', 'true');
            currentForm.submit();
            currentForm = null;
        }
        modal.hide();
    });

    // Reset state when modal is hidden
    confirmationModal.addEventListener('hidden.bs.modal', function() {
        currentAction = null;
        currentForm = null;
        messageElement.textContent = 'Are you sure you want to proceed with this action?';
    });
}

// Initialize progress bars to set width from data attribute
function initProgressBars() {
    const progressBars = document.querySelectorAll('.progress[data-progress]');

    progressBars.forEach(progressContainer => {
        const progressValue = progressContainer.getAttribute('data-progress');
        const progressBar = progressContainer.querySelector('.progress-bar');

        if (progressBar && progressValue) {
            progressBar.style.width = `${progressValue}%`;
        }
    });
}

// Initialize Bootstrap tooltips
function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Expose functions globally to maintain compatibility
window.initBookReordering = initBookReordering;
window.initBookAttribution = initBookAttribution;
window.initAddBookForm = initAddBookForm;
window.initConfirmationModal = initConfirmationModal;
window.initProgressBars = initProgressBars;
window.initTooltips = initTooltips;