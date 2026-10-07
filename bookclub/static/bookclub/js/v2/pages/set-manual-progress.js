function initProgressTypeToggle() {
    const progressType = document.getElementById('progress_type');
    const percentHelp = document.getElementById('percent-help');
    const pageHelp = document.getElementById('page-help');
    const audioHelp = document.getElementById('audio-help');

    if (!progressType || !percentHelp || !pageHelp || !audioHelp) return;

    function updateHelpText() {
        const type = progressType.value;

        percentHelp.style.display = 'none';
        pageHelp.style.display = 'none';
        audioHelp.style.display = 'none';

        if (type === 'percent') {
            percentHelp.style.display = 'block';
        } else if (type === 'page') {
            pageHelp.style.display = 'block';
        } else if (type === 'audio') {
            audioHelp.style.display = 'block';
        }
    }

    updateHelpText();

    progressType.addEventListener('change', updateHelpText);
}

function initFormAnimation() {
    const cards = document.querySelectorAll('.current-progress-card, .edition-info-card, .update-form-card');

    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + (100 * index));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initProgressTypeToggle();
    initFormAnimation();
});
