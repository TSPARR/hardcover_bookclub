document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.querySelector('#searchForm input[type="text"]');
    const clearBtn = document.getElementById('clearBtn');
    const clearEmptyBtn = document.getElementById('clearEmptyBtn');
    const searchContainer = document.querySelector('.search-container-sticky');

    if (searchInput && clearBtn) {
        function toggleClearButton() {
            if (searchInput.value.trim().length > 0) {
                clearBtn.classList.remove('d-none');
            } else {
                clearBtn.classList.add('d-none');
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
                    clearBtn.classList.add('d-none');
                }
            }
        });
    }

    if (searchContainer) {
        let lastScrollTop = 0;

        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > 100) {
                searchContainer.classList.add('scrolled');
            } else {
                searchContainer.classList.remove('scrolled');
            }

            lastScrollTop = scrollTop;
        });
    }

    if (searchInput) {
        searchInput.setAttribute('placeholder', 'Search by title, author, or ISBN...');
        searchInput.setAttribute('autocomplete', 'off');
    }
});
