function initializePage() {
    const form = document.getElementById('createInvitationForm');

    if (form) {
        form.addEventListener('submit', function(e) {
            const button = this.querySelector('.btn-create');
            if (button) {
                button.classList.add('loading');
                button.disabled = true;
                const buttonText = button.querySelector('span');
                if (buttonText) {
                    buttonText.innerHTML = '<i class="bi bi-hourglass-split"></i> Creating...';
                }
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
