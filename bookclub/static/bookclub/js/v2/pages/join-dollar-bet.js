document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Joining...';
            }
        });
    }

    const textarea = document.querySelector('.form-textarea');
    if (textarea) {
        textarea.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        textarea.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    }
});
