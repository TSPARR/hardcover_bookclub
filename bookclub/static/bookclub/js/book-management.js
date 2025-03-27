/**
 * Book management functionality for book clubs
 */

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
    
    // Function to update the hidden input with the book order
    function updateBookOrderInput() {
        const bookItems = document.querySelectorAll('#sortableBooks li');
        const bookIds = Array.from(bookItems).map(function(item) {
            return item.getAttribute('data-id');
        });
        
        document.getElementById('bookOrderInput').value = bookIds.join(',');
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
    
    // Initialize the book order input on page load
    updateBookOrderInput();
    
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
            
            document.getElementById('attributionBookId').value = bookId;
            document.getElementById('attributionBookTitle').textContent = bookTitle;
            
            const pickedBySelect = document.getElementById('pickedBy');
            if (pickedBy) {
                pickedBySelect.value = pickedBy;
            } else {
                pickedBySelect.value = '';
            }
            
            const collectiveCheck = document.getElementById('isCollectivePick');
            collectiveCheck.checked = isCollective;
            
            // Toggle visibility of picked by section based on collective pick checkbox
            togglePickedBySection(isCollective);
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
        document.getElementById('pickedBy').value = '';
    } else {
        pickedBySection.style.display = 'block';
    }
}

// Initialize add book form functionality
function initAddBookForm() {
    // Toggle picked by section when collective pick checkbox changes
    const collectiveCheck = document.getElementById('id_is_collective_pick');
    if (!collectiveCheck) return;
    
    collectiveCheck.addEventListener('change', function() {
        togglePickedBySection(this.checked);
    });
}

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all book management features
    initBookSorting();
    initBookAttribution();
    initAddBookForm();
});