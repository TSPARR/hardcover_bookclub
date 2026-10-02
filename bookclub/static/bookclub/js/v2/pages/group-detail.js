let currentModalAction = null;

const dropdownBtn = document.getElementById('groupSettingsBtn');
const dropdownMenu = document.getElementById('groupSettingsMenu');

if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = dropdownBtn.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            closeMainDropdown();
        } else {
            openMainDropdown();
        }
    });

    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && e.target !== dropdownBtn) {
            closeMainDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMainDropdown();
            closeAllBookDropdowns();
        }
    });
}

function openMainDropdown() {
    dropdownBtn.setAttribute('aria-expanded', 'true');
    dropdownMenu.classList.add('active');
}

function closeMainDropdown() {
    dropdownBtn.setAttribute('aria-expanded', 'false');
    dropdownMenu.classList.remove('active');
}

const bookDropdownTriggers = document.querySelectorAll('.dropdown-trigger[data-dropdown]');

bookDropdownTriggers.forEach(trigger => {
    const dropdownId = trigger.getAttribute('data-dropdown');
    const menu = document.getElementById(dropdownId);

    if (menu) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

            closeAllBookDropdowns();

            if (!isExpanded) {
                trigger.setAttribute('aria-expanded', 'true');
                menu.classList.add('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                trigger.setAttribute('aria-expanded', 'false');
                menu.classList.remove('active');
            }
        });
    }
});

function closeAllBookDropdowns() {
    bookDropdownTriggers.forEach(trigger => {
        trigger.setAttribute('aria-expanded', 'false');
        const dropdownId = trigger.getAttribute('data-dropdown');
        const menu = document.getElementById(dropdownId);
        if (menu) {
            menu.classList.remove('active');
        }
    });
}

const attributionModal = document.getElementById('attributionModal');
const attributionModalClose = document.getElementById('attributionModalClose');
const attributionCancelButton = document.getElementById('attributionCancelButton');

const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalClose = document.getElementById('confirmationModalClose');
const confirmationModalCancel = document.getElementById('confirmationModalCancel');
const confirmationModalConfirm = document.getElementById('confirmationModalConfirm');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    if (attributionModal) closeModal(attributionModal);
    if (confirmationModal) {
        closeModal(confirmationModal);
        currentModalAction = null;
    }
}

if (attributionModalClose) {
    attributionModalClose.addEventListener('click', () => closeModal(attributionModal));
}

if (attributionCancelButton) {
    attributionCancelButton.addEventListener('click', () => closeModal(attributionModal));
}

if (confirmationModalClose) {
    confirmationModalClose.addEventListener('click', () => {
        closeModal(confirmationModal);
        currentModalAction = null;
    });
}

if (confirmationModalCancel) {
    confirmationModalCancel.addEventListener('click', () => {
        closeModal(confirmationModal);
        currentModalAction = null;
    });
}

if (confirmationModalConfirm) {
    confirmationModalConfirm.addEventListener('click', () => {
        if (currentModalAction) {
            currentModalAction();
            currentModalAction = null;
        }
        closeModal(confirmationModal);
    });
}

if (attributionModal) {
    attributionModal.addEventListener('click', (e) => {
        if (e.target === attributionModal) {
            closeModal(attributionModal);
        }
    });
}

if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal(confirmationModal);
            currentModalAction = null;
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-attribution') || e.target.closest('.edit-attribution')) {
        e.preventDefault();
        const button = e.target.classList.contains('edit-attribution') ? e.target : e.target.closest('.edit-attribution');
        const bookId = button.getAttribute('data-book-id');
        const bookTitle = button.getAttribute('data-book-title');
        const pickedBy = button.getAttribute('data-picked-by');
        const isCollective = button.getAttribute('data-collective') === 'true';

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
            togglePickedBySection(isCollective);
        }

        if (attributionModal) {
            openModal(attributionModal);
        }
    }
});

const collectiveCheckbox = document.getElementById('isCollectivePick');
if (collectiveCheckbox) {
    collectiveCheckbox.addEventListener('change', function() {
        togglePickedBySection(this.checked);
    });
}

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

function showConfirmation(message, action) {
    if (confirmationModalMessage) {
        confirmationModalMessage.textContent = message;
    }
    currentModalAction = action;
    if (confirmationModal) {
        openModal(confirmationModal);
    }
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-book-action') || e.target.closest('.remove-book-action')) {
        e.preventDefault();
        const button = e.target.classList.contains('remove-book-action') ? e.target : e.target.closest('.remove-book-action');
        const bookId = button.getAttribute('data-book-id');
        const groupId = button.getAttribute('data-group-id');

        showConfirmation('Are you sure you want to remove this book? This action cannot be undone.', () => {
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
        });
    }
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('refresh-book-action') || e.target.closest('.refresh-book-action')) {
        e.preventDefault();
        const button = e.target.classList.contains('refresh-book-action') ? e.target : e.target.closest('.refresh-book-action');
        const bookId = button.getAttribute('data-book-id');

        showConfirmation('Refresh book details from Hardcover? This will update the book information.', () => {
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
        });
    }
});

const createMeetingModal = document.getElementById('createMeetingModal');
const createMeetingBtn = document.getElementById('createMeetingBtn');
const createMeetingBtns = document.querySelectorAll('.create-meeting-btn');
const createMeetingModalClose = document.getElementById('createMeetingModalClose');
const createMeetingCancelButton = document.getElementById('createMeetingCancelButton');
const createMeetingForm = document.getElementById('createMeetingForm');
const createMeetingError = document.getElementById('createMeetingError');

function openCreateMeetingModal() {
    if (createMeetingModal) {
        openModal(createMeetingModal);
    }
}

function closeCreateMeetingModal() {
    if (createMeetingModal) {
        closeModal(createMeetingModal);
        if (createMeetingForm) {
            createMeetingForm.reset();
        }
        if (createMeetingError) {
            createMeetingError.classList.remove('show');
            createMeetingError.textContent = '';
        }
    }
}

if (createMeetingBtn) {
    createMeetingBtn.addEventListener('click', openCreateMeetingModal);
}

createMeetingBtns.forEach(btn => {
    btn.addEventListener('click', openCreateMeetingModal);
});

if (createMeetingModalClose) {
    createMeetingModalClose.addEventListener('click', closeCreateMeetingModal);
}

if (createMeetingCancelButton) {
    createMeetingCancelButton.addEventListener('click', closeCreateMeetingModal);
}

if (createMeetingModal) {
    createMeetingModal.addEventListener('click', (e) => {
        if (e.target === createMeetingModal) {
            closeCreateMeetingModal();
        }
    });
}

if (createMeetingForm) {
    createMeetingForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (createMeetingError) {
            createMeetingError.classList.remove('show');
            createMeetingError.textContent = '';
        }

        const formData = new FormData(createMeetingForm);
        const groupId = createMeetingForm.getAttribute('data-group-id');
        formData.append('group', groupId);

        const endTime = formData.get('end_time');
        if (endTime !== null && String(endTime).trim() === '') {
            formData.delete('end_time');
        }

        const submitButton = createMeetingForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Creating...';

        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        const headers = {
            'Accept': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') || '',
        };

        try {
            const response = await fetch('/api/meetings/create/', {
                method: 'POST',
                headers: headers,
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                if (createMeetingError) {
                    createMeetingError.textContent = data && (data.error || data.detail || 'Failed to create meeting.');
                    createMeetingError.classList.add('show');
                }
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
                return;
            }

            window.location.reload();
        } catch (err) {
            if (createMeetingError) {
                createMeetingError.textContent = 'Network error. Please try again.';
                createMeetingError.classList.add('show');
            }
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
}
