function initProgressTypeHelp() {
    const progressType = document.getElementById('comment_progress_type');
    const progressHelp = document.getElementById('commentProgressHelp');

    if (progressType && progressHelp) {
        progressType.addEventListener('change', () => {
            const type = progressType.value;

            if (type === 'page') {
                progressHelp.textContent = 'Enter the page number you\'re commenting about.';
            } else if (type === 'audio') {
                progressHelp.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                progressHelp.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProgressTypeHelp();

    document.querySelectorAll('.comment-form, .action-form').forEach((form, index) => {
        form.style.opacity = '0';
        form.style.transform = 'translateY(20px)';
        form.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setTimeout(() => {
            form.style.opacity = '1';
            form.style.transform = 'translateY(0)';
        }, 200 + (100 * index));
    });
});
