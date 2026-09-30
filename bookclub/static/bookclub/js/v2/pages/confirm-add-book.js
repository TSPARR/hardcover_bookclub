document.addEventListener('DOMContentLoaded', function () {
    const collectiveCheck = document.getElementById('id_is_collective_pick');
    const pickedBySection = document.getElementById('pickedBySection');
    const pickedBySelect = document.getElementById('id_picked_by');
    const setActiveCheck = document.getElementById('id_set_active');
    const setActiveHint = document.getElementById('setActiveHint');
    const addBookForm = document.getElementById('addBookForm');

    const infoDetails = document.querySelector('.info-card details');
    if (infoDetails && window.innerWidth <= 991) {
        infoDetails.removeAttribute('open');
    }

    if (collectiveCheck && pickedBySection) {
        collectiveCheck.addEventListener('change', function() {
            if (this.checked) {
                pickedBySection.style.display = 'none';
                if (pickedBySelect) {
                    pickedBySelect.value = '';
                }
            } else {
                pickedBySection.style.display = 'block';
            }
        });
    }

    if (setActiveCheck && setActiveHint) {
        setActiveHint.style.display = setActiveCheck.checked ? 'block' : 'none';

        setActiveCheck.addEventListener('change', function() {
            setActiveHint.style.display = this.checked ? 'block' : 'none';
        });
    }

    if (addBookForm) {
        addBookForm.addEventListener('submit', function() {
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Adding...';
            }
        });
    }
});
