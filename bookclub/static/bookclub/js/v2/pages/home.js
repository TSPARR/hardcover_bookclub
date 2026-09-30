document.addEventListener('DOMContentLoaded', function() {
    const readingItems = document.querySelectorAll('.reading-item');
    const groupItems = document.querySelectorAll('.group-item');

    readingItems.forEach((item, index) => {
        item.style.animation = `fadeIn 0.6s var(--ease-out-expo) ${index * 0.1}s both`;
    });

    groupItems.forEach((item, index) => {
        item.style.animation = `fadeIn 0.6s var(--ease-out-expo) ${index * 0.1}s both`;
    });
});
