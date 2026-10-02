(function() {
    'use strict';
    const editButton = document.getElementById('editMeetingButton');
    const modalOverlay = document.getElementById('editMeetingModal');
    const modalClose = document.getElementById('modalClose');
    const cancelButton = document.getElementById('cancelButton');
    const editForm = document.getElementById('editMeetingForm');
    const errorBox = document.getElementById('editMeetingError');

    if (editButton && modalOverlay) {
        editButton.addEventListener('click', function() {
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        function closeModal() {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', closeModal);
        }
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                closeModal();
            }
        });
    }
    if (editForm) {
        const updateUrl = editForm.dataset.updateUrl;

        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (errorBox) {
                errorBox.classList.remove('show');
                errorBox.textContent = '';
            }

            const formData = new FormData(editForm);
            const startTime = formData.get('start_time');

            if (!startTime) {
                if (errorBox) {
                    errorBox.textContent = 'Start time is required.';
                    errorBox.classList.add('show');
                }
                return;
            }

            const endTime = formData.get('end_time');
            if (endTime !== null && String(endTime).trim() === '') {
                formData.delete('end_time');
            }

            const submitButton = editForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Saving...';

            const headers = {
                'Accept': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || '',
            };

            try {
                const response = await fetch(updateUrl, {
                    method: 'POST',
                    headers: headers,
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    if (errorBox) {
                        errorBox.textContent = data && (data.error || data.detail || 'Failed to update meeting.');
                        errorBox.classList.add('show');
                    }
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                    return;
                }

                window.location.reload();
            } catch (err) {
                if (errorBox) {
                    errorBox.textContent = 'Network error. Please try again.';
                    errorBox.classList.add('show');
                }
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }

    const actionForms = document.querySelectorAll('.action-form');
    actionForms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                const icon = submitButton.querySelector('i');
                if (icon) {
                    icon.className = 'bi bi-arrow-repeat';
                }
            }
        });
    });
})();
