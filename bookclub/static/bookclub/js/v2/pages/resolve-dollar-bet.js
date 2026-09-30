document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const resolutionRadios = document.querySelectorAll('input[name="resolution"]');
    const winnerCheckboxes = document.querySelectorAll('.winner-checkbox');
    const validationError = document.getElementById('winner-validation-error');
    const winnerSection = document.getElementById('winnerSelectionSection');
    const isMultiParty = winnerCheckboxes.length > 0;

    resolutionRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'winner') {
                winnerSection.style.display = 'block';
            } else {
                winnerSection.style.display = 'none';
                if (validationError) {
                    validationError.classList.remove('active');
                }
                if (isMultiParty) {
                    winnerCheckboxes.forEach(cb => cb.checked = false);
                }
            }
        });
    });

    if (form) {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            const resolution = document.querySelector('input[name="resolution"]:checked').value;

            if (resolution === 'winner' && isMultiParty) {
                const checkedWinners = document.querySelectorAll('.winner-checkbox:checked');
                if (checkedWinners.length === 0) {
                    e.preventDefault();
                    validationError.classList.add('active');
                    validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return false;
                }
                validationError.classList.remove('active');
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Resolving...';
            }
        });
    }

    if (isMultiParty) {
        winnerCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                if (document.querySelectorAll('.winner-checkbox:checked').length > 0) {
                    validationError.classList.remove('active');
                }
            });
        });
    }
});
