function initializePage() {
    const joinForm = document.getElementById('joinForm');

    if (joinForm) {
        joinForm.addEventListener('submit', function(e) {
            const button = this.querySelector('.btn-join');
            if (button) {
                button.classList.add('loading');
                const buttonText = button.querySelector('span');
                if (buttonText) {
                    buttonText.textContent = 'Joining...';
                }
            }
        });
    }

    const formGroups = document.querySelectorAll('.form-group, .form-row');
    formGroups.forEach((group, index) => {
        group.style.opacity = '0';
        group.style.transform = 'translateY(10px)';
        setTimeout(() => {
            group.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            group.style.opacity = '1';
            group.style.transform = 'translateY(0)';
        }, 100 + (index * 50));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
