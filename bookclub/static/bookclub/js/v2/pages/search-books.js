function initializePage() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = searchForm?.querySelector('input[type="text"]');
    const clearBtn = document.getElementById('clearBtn');
    const clearEmptyBtn = document.getElementById('clearEmptyBtn');
    const searchContainer = document.getElementById('searchContainer');

    if (searchInput && clearBtn) {
        function toggleClearButton() {
            if (searchInput.value.trim().length > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }

        toggleClearButton();

        searchInput.addEventListener('input', toggleClearButton);

        clearBtn.addEventListener('click', function() {
            searchInput.value = '';
            searchInput.focus();
            toggleClearButton();
        });
    }

    if (clearEmptyBtn) {
        clearEmptyBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                if (clearBtn) {
                    clearBtn.classList.add('hidden');
                }
            }
        });
    }

    if (searchContainer) {
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > 100) {
                searchContainer.classList.add('scrolled');
            } else {
                searchContainer.classList.remove('scrolled');
            }
        });
    }

    if (searchInput) {
        searchInput.setAttribute('autocomplete', 'off');
    }

    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton && searchInput && searchInput.value.trim()) {
                submitButton.disabled = true;
                const originalText = submitButton.innerHTML;
                submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Searching...';

                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                }, 3000);
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
