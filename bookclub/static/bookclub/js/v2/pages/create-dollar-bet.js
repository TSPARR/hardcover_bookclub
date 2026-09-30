document.addEventListener('DOMContentLoaded', function() {
    const betTypeSelect = document.getElementById('bet_type');
    const twoPartyFields = document.getElementById('two-party-fields');
    const multiPartyFields = document.getElementById('multi-party-fields');
    const form = document.querySelector('form');

    const infoDetails = document.querySelector('.info-sidebar details');
    if (infoDetails && window.innerWidth <= 991) {
        infoDetails.removeAttribute('open');
    }

    function updateFieldsDisplay() {
        const betType = betTypeSelect.value;

        if (betType === 'two_party') {
            twoPartyFields.classList.add('active');
            multiPartyFields.classList.remove('active');

            const descriptionField = document.getElementById('description');
            const questionField = document.getElementById('question');
            const predictionField = document.getElementById('my_prediction');

            if (descriptionField) descriptionField.required = true;
            if (questionField) questionField.required = false;
            if (predictionField) predictionField.required = false;
        } else {
            twoPartyFields.classList.remove('active');
            multiPartyFields.classList.add('active');

            const descriptionField = document.getElementById('description');
            const questionField = document.getElementById('question');
            const predictionField = document.getElementById('my_prediction');

            if (descriptionField) descriptionField.required = false;
            if (questionField) questionField.required = true;
            if (predictionField) predictionField.required = true;
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
