document.addEventListener('DOMContentLoaded', function () {
    const filterButtons = document.querySelectorAll('.format-filter-btn');
    const editionCardWrappers = document.querySelectorAll('.edition-card-wrapper');
    const formatCountBadges = document.querySelectorAll('.format-count');
    const noResultsMsg = document.getElementById('no-editions-filtered');

    let activeFormatId = null;

    updateFormatCounts();

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const formatId = this.getAttribute('data-format-id');

            if (this.classList.contains('active')) {
                this.classList.remove('active');
                activeFormatId = null;
            } else {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                activeFormatId = formatId;
            }

            filterEditions(activeFormatId);
        });
    });

    function filterEditions(formatId) {
        editionCardWrappers.forEach(wrapper => {
            const card = wrapper.querySelector('.edition-card');
            if (!formatId || card.getAttribute('data-format-id') === formatId) {
                wrapper.style.display = 'block';
            } else {
                wrapper.style.display = 'none';
            }
        });

        updateNoResultsMessage(formatId);
    }

    function updateNoResultsMessage(formatId) {
        if (!noResultsMsg) return;

        const visibleWrappers = Array.from(editionCardWrappers).filter(wrapper =>
            wrapper.style.display !== 'none'
        );

        if (formatId && visibleWrappers.length === 0) {
            const formatName = getFormatName(formatId);
            const messageSpan = noResultsMsg.querySelector('span');
            messageSpan.textContent = `No ${formatName} editions available for this book.`;
            noResultsMsg.classList.remove('hidden');
        } else {
            noResultsMsg.classList.add('hidden');
        }
    }

    function getFormatName(formatId) {
        switch(formatId) {
            case '1': return 'physical';
            case '2': return 'audiobook';
            case '4': return 'ebook';
            default: return '';
        }
    }

    function updateFormatCounts() {
        const formatCounts = {
            '1': 0,
            '2': 0,
            '4': 0
        };

        editionCardWrappers.forEach(wrapper => {
            const card = wrapper.querySelector('.edition-card');
            const formatId = card.getAttribute('data-format-id');
            if (formatId && formatCounts.hasOwnProperty(formatId)) {
                formatCounts[formatId]++;
            }
        });

        formatCountBadges.forEach(badge => {
            const formatId = badge.getAttribute('data-format-id');
            if (formatId && formatCounts.hasOwnProperty(formatId)) {
                badge.textContent = formatCounts[formatId];

                if (formatCounts[formatId] === 0) {
                    badge.classList.add('hidden');
                    const parentButton = badge.closest('button');
                    if (parentButton) {
                        parentButton.disabled = true;
                    }
                } else {
                    badge.classList.remove('hidden');
                }
            }
        });
    }

    const editionForms = document.querySelectorAll('.edition-form, .clear-form');
    editionForms.forEach(form => {
        form.addEventListener('submit', function() {
            const button = this.querySelector('button[type="submit"]');
            if (button && !button.disabled) {
                button.disabled = true;
                button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Loading...';
            }
        });
    });
});
