/**
 * Book management functionality for book clubs
 */

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all book management features
    initBookSorting();
    initBookAttribution();
    initAddBookForm();
    initEditModeToggle();
});

// Initialize edit mode toggle in the group detail page
function initEditModeToggle() {
    // Desktop edit mode toggle
    const toggleEditModeBtn = document.getElementById('toggleEditMode');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const reorderForm = document.getElementById('reorderForm');
    const readOnlyBooks = document.getElementById('readOnlyBooks');
    
    if (toggleEditModeBtn && reorderForm && readOnlyBooks) {
        toggleEditModeBtn.addEventListener('click', function() {
            reorderForm.classList.remove('d-none');
            readOnlyBooks.classList.add('d-none');
            toggleEditModeBtn.classList.add('d-none');
        });
        
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent form submission
                reorderForm.classList.add('d-none');
                readOnlyBooks.classList.remove('d-none');
                toggleEditModeBtn.classList.remove('d-none');
            });
        }
    }
    
    // Mobile edit mode toggle
    const mobileToggleBtn = document.getElementById('mobileToggleEditMode');
    const mobileCancelBtn = document.getElementById('mobileCancelEdit');
    const mobileReorderForm = document.getElementById('mobileReorderForm');
    const mobileReadOnlyBooks = document.getElementById('mobileReadOnlyBooks');
    
    if (mobileToggleBtn && mobileReorderForm && mobileReadOnlyBooks) {
        mobileToggleBtn.addEventListener('click', function() {
            mobileReorderForm.classList.remove('d-none');
            mobileReadOnlyBooks.classList.add('d-none');
            mobileToggleBtn.classList.add('d-none');
        });
        
        if (mobileCancelBtn) {
            mobileCancelBtn.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent form submission
                mobileReorderForm.classList.add('d-none');
                mobileReadOnlyBooks.classList.remove('d-none');
                mobileToggleBtn.classList.remove('d-none');
            });
        }
    }
}

// Initialize book sorting functionality
function initBookSorting() {
    const booksList = document.getElementById('sortableBooks');
    if (!booksList) return;
    
    // Set up sortable for book reordering
    new Sortable(booksList, {
        animation: 150,
        handle: '.handle',
        ghostClass: 'sortable-ghost',
        onEnd: function() {
            // Update the book numbers
            updateBookNumbers();
        }
    });
    
    // Get the save button
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            // Get the current order of books (only from sortableBooks)
            const bookItems = document.querySelectorAll('#sortableBooks > li');
            
            // Use a Set to ensure no duplicate book IDs
            const uniqueBookIds = new Set();
            bookItems.forEach(item => {
                const bookId = item.getAttribute('data-id');
                if (bookId) {
                    uniqueBookIds.add(bookId);
                }
            });
            
            // Convert the Set to an Array
            const bookIds = Array.from(uniqueBookIds);
            
            // Debug info
            
            // Create FormData
            const formData = new FormData();
            bookIds.forEach(id => {
                formData.append('book_order', id);
            });
            
            // Get the current URL (which should be the group detail page)
            const url = window.location.href;
            
            // Submit with fetch
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken,
                }
            })
            .then(response => {
                if (response.ok) {
                    // If successful, reload the page
                    window.location.reload();
                } else {
                    console.error('Error saving book order');
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        });
    }
}

// Function to update book numbers after reordering
function updateBookNumbers() {
    const bookItems = document.querySelectorAll('#sortableBooks li');
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

// Expose functions globally to maintain compatibility
window.initBookSorting = initBookSorting;
window.initBookAttribution = initBookAttribution;
window.initAddBookForm = initAddBookForm;
window.initEditModeToggle = initEditModeToggle;