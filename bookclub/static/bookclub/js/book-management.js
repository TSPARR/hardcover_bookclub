/**
 * Book management functionality for book clubs
 */

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all book management features
    initBookOrderModal();
    initBookAttribution();
    initAddBookForm();
    initConfirmationModal();
});

// Initialize book order modal functionality
function initBookOrderModal() {
    const modal = document.getElementById('bookOrderModal');
    if (!modal) {
        console.log('Book order modal not found');
        return;
    }

    console.log('Initializing book order modal');
    const booksList = document.getElementById('sortableBooksModal');
    const saveBtn = document.getElementById('saveBookOrder');
    let sortableInstance = null;

    // Debug: Log when modal is triggered
    const modalTriggers = document.querySelectorAll('[data-bs-target="#bookOrderModal"]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            console.log('Modal trigger clicked');
        });
    });

    // Initialize sortable when modal is shown
    modal.addEventListener('shown.bs.modal', function() {
        console.log('Modal shown event fired');
        if (booksList && !sortableInstance) {
            sortableInstance = new Sortable(booksList, {
                animation: 150,
                handle: '.handle',
                ghostClass: 'sortable-ghost',
                onEnd: function() {
                    updateBookNumbers();
                }
            });
            console.log('Sortable initialized');
        }
    });

    // Save button handler
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const bookItems = document.querySelectorAll('#sortableBooksModal > li');

            // Get book IDs in current order
            const bookIds = Array.from(bookItems).map(item => item.getAttribute('data-id'));

            // Create FormData
            const formData = new FormData();
            bookIds.forEach(id => {
                formData.append('book_order', id);
            });

            // Submit
            fetch(window.location.href, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken,
                }
            })
            .then(response => {
                if (response.ok) {
                    window.location.reload();
                } else {
                    console.error('Error saving book order');
                    alert('Failed to save book order. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            });
        });
    }
}

// Function to update book numbers after reordering
function updateBookNumbers() {
    const bookItems = document.querySelectorAll('#sortableBooksModal li');
    bookItems.forEach((item, index) => {
        // Update the data-order attribute
        item.setAttribute('data-order', index + 1);
        
        // Update the visible number badge
        const numberBadge = item.querySelector('.book-number');
        if (numberBadge) {
            numberBadge.textContent = index + 1;
        }
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

// Expose functions globally to maintain compatibility
window.initBookOrderModal = initBookOrderModal;
window.initBookAttribution = initBookAttribution;
window.initAddBookForm = initAddBookForm;
window.initConfirmationModal = initConfirmationModal;