document.addEventListener('DOMContentLoaded', function() {
    const betTypeSelect = document.getElementById('bet_type');
    const twoPartyFields = document.getElementById('two-party-fields');
    const multiPartyFields = document.getElementById('multi-party-fields');
    const twoPartyAlert = document.getElementById('two-party-alert');
    const multiPartyAlert = document.getElementById('multi-party-alert');
    const form = document.querySelector('form');

    function updateFieldsDisplay() {
        const betType = betTypeSelect.value;

        if (betType === 'two_party') {
            twoPartyFields.classList.add('active');
            multiPartyFields.classList.remove('active');
            twoPartyAlert.classList.add('active');
            multiPartyAlert.classList.remove('active');

            document.getElementById('proposer').required = true;
            document.getElementById('accepter').required = true;
            document.getElementById('description').required = true;
            document.getElementById('question').required = false;
        } else {
            twoPartyFields.classList.remove('active');
            multiPartyFields.classList.add('active');
            twoPartyAlert.classList.remove('active');
            multiPartyAlert.classList.add('active');

            document.getElementById('proposer').required = false;
            document.getElementById('accepter').required = false;
            document.getElementById('description').required = false;
            document.getElementById('question').required = true;
        }
    }

    if (betTypeSelect) {
        betTypeSelect.addEventListener('change', updateFieldsDisplay);
        updateFieldsDisplay();
    }

    if (form) {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Creating Bet...';
            }
        });
    }

    const formInputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
});
