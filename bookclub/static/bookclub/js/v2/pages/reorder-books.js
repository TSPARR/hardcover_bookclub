// Reorder Books Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const bookList = document.getElementById('bookList');
    if (!bookList) return;

    const reorderItems = bookList.querySelectorAll('.reorder-item');
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    // Drag and Drop functionality
    let draggedItem = null;

    reorderItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.draggable = true;
    });

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        const allItems = Array.from(bookList.querySelectorAll('.reorder-item'));
        allItems.forEach(item => item.classList.remove('drag-over'));

        if (this !== draggedItem) {
            this.classList.add('drag-over');
        }

        return false;
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedItem !== this) {
            // Get current positions
            const allItems = Array.from(bookList.querySelectorAll('.reorder-item'));
            const draggedIndex = allItems.indexOf(draggedItem);
            const targetIndex = allItems.indexOf(this);

            // Move the dragged item to the new position
            if (draggedIndex < targetIndex) {
                this.parentNode.insertBefore(draggedItem, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedItem, this);
            }

            // Update the order numbers
            updateOrderNumbers();

            // Send update to server
            const bookId = draggedItem.dataset.bookId;
            const direction = draggedIndex < targetIndex ? 'down' : 'up';
            const moves = Math.abs(targetIndex - draggedIndex);

            // Make multiple API calls if needed to move the book to the correct position
            moveBookMultipleTimes(bookId, direction, moves);
        }

        return false;
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        const allItems = Array.from(bookList.querySelectorAll('.reorder-item'));
        allItems.forEach(item => item.classList.remove('drag-over'));
    }

    // Arrow button functionality
    const reorderButtons = document.querySelectorAll('.btn-reorder');
    reorderButtons.forEach(button => {
        button.addEventListener('click', handleReorder);
    });

    async function handleReorder(e) {
        e.preventDefault();
        const button = this;
        const bookId = button.dataset.bookId;
        const direction = button.dataset.direction;

        // Disable button during request
        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="bi bi-arrow-repeat"></i>';

        try {
            const groupId = window.location.pathname.split('/')[2]; // Extract from URL
            const response = await fetch(`/groups/${groupId}/books/${bookId}/reorder/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': csrfToken
                },
                body: `direction=${direction}`
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Move the item in the DOM
                const item = button.closest('.reorder-item');
                if (direction === 'up') {
                    const prevItem = item.previousElementSibling;
                    if (prevItem) {
                        bookList.insertBefore(item, prevItem);
                    }
                } else if (direction === 'down') {
                    const nextItem = item.nextElementSibling;
                    if (nextItem) {
                        bookList.insertBefore(nextItem, item);
                    }
                }

                // Update order numbers
                updateOrderNumbers();

                // Show success feedback
                item.style.background = 'rgba(45, 74, 62, 0.1)';
                setTimeout(() => {
                    item.style.background = '';
                }, 500);
            } else {
                throw new Error(data.error || 'Failed to reorder book');
            }
        } catch (error) {
            console.error('Reorder error:', error);
            alert('Failed to reorder book. Please try again.');
        } finally {
            // Re-enable button
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }

    async function moveBookMultipleTimes(bookId, direction, times) {
        const groupId = window.location.pathname.split('/')[2];

        for (let i = 0; i < times; i++) {
            try {
                const response = await fetch(`/groups/${groupId}/books/${bookId}/reorder/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': csrfToken
                    },
                    body: `direction=${direction}`
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to reorder book');
                }
            } catch (error) {
                console.error('Reorder error:', error);
                alert('Failed to reorder book. Please refresh the page and try again.');
                location.reload();
                return;
            }
        }
    }

    function updateOrderNumbers() {
        const items = bookList.querySelectorAll('.reorder-item');
        items.forEach((item, index) => {
            const numberSpan = item.querySelector('.reorder-number');
            if (numberSpan) {
                numberSpan.textContent = index + 1;
            }
        });
    }
});
