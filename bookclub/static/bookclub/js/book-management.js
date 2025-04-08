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
            // When reordering ends, update the hidden input with the new order
            updateBookOrderInput();
            // Update the book numbers
            updateBookNumbers();
        }
    });
    
    // Handle form submission for reordering
    const reorderForm = document.getElementById('reorderForm');
    if (reorderForm) {
        reorderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Update the input one more time to ensure it has the latest order
            updateBookOrderInput();
            
            // Create an array of inputs for book order
            const bookIds = document.getElementById('bookOrderInput').value.split(',');
            const form = this;
            
            // Remove any existing book_order inputs
            const existingInputs = form.querySelectorAll('input[name="book_order"]');
            existingInputs.forEach(function(input) {
                input.remove();
            });
            
            // Add new inputs for each book ID
            bookIds.forEach(function(bookId) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'book_order';
                input.value = bookId;
                form.appendChild(input);
            });
            
            // Submit the form
            form.submit();
        });
    }
    
    // Initialize the book order input on page load
    updateBookOrderInput();
}

// Function to update the hidden input with the book order
function updateBookOrderInput() {
    const bookOrderInput = document.getElementById('bookOrderInput');
    if (!bookOrderInput) return;
    
    const bookItems = document.querySelectorAll('#sortableBooks li');
    const bookIds = Array.from(bookItems).map(function(item) {
        return item.getAttribute('data-id');
    });
    
    bookOrderInput.value = bookIds.join(',');
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