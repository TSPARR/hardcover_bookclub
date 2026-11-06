const deleteProposalModal = document.getElementById('deleteProposalModal');
const deleteModalClose = document.getElementById('deleteModalClose');
const deleteModalCancel = document.getElementById('deleteModalCancel');
const deleteModalConfirm = document.getElementById('deleteModalConfirm');
const deleteProposalForm = document.getElementById('deleteProposalForm');

const modalProposalCover = document.getElementById('modalProposalCover');
const modalProposalTitle = document.getElementById('modalProposalTitle');
const modalProposalAuthor = document.getElementById('modalProposalAuthor');
const modalProposalMeta = document.getElementById('modalProposalMeta');

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeDeleteModal() {
    closeModal(deleteProposalModal);
}

if (deleteModalClose) {
    deleteModalClose.addEventListener('click', closeDeleteModal);
}

if (deleteModalCancel) {
    deleteModalCancel.addEventListener('click', closeDeleteModal);
}

if (deleteModalConfirm) {
    deleteModalConfirm.addEventListener('click', () => {
        if (deleteProposalForm) {
            const submitButton = deleteModalConfirm;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Deleting...';
            deleteProposalForm.submit();
        }
    });
}

if (deleteProposalModal) {
    deleteProposalModal.addEventListener('click', (e) => {
        if (e.target === deleteProposalModal) {
            closeDeleteModal();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deleteProposalModal && deleteProposalModal.classList.contains('active')) {
        closeDeleteModal();
    }
});

const deleteButtons = document.querySelectorAll('.delete-proposal-btn');

deleteButtons.forEach(button => {
    button.addEventListener('click', () => {
        const proposalTitle = button.getAttribute('data-proposal-title');
        const proposalAuthor = button.getAttribute('data-proposal-author');
        const proposalCover = button.getAttribute('data-proposal-cover');
        const proposedBy = button.getAttribute('data-proposed-by');
        const proposedDate = button.getAttribute('data-proposed-date');
        const deleteUrl = button.getAttribute('data-delete-url');

        if (modalProposalTitle) {
            modalProposalTitle.textContent = proposalTitle;
        }

        if (modalProposalAuthor) {
            modalProposalAuthor.textContent = `by ${proposalAuthor}`;
        }

        if (modalProposalMeta) {
            modalProposalMeta.textContent = `Proposed by ${proposedBy} on ${proposedDate}`;
        }

        if (modalProposalCover) {
            if (proposalCover) {
                modalProposalCover.innerHTML = `<img src="${proposalCover}" alt="${proposalTitle}">`;
            } else {
                modalProposalCover.innerHTML = '<div class="no-cover"><i class="bi bi-book"></i></div>';
            }
        }

        if (deleteProposalForm) {
            deleteProposalForm.action = deleteUrl;
        }

        if (deleteProposalModal) {
            openModal(deleteProposalModal);
        }
    });
});

const voteButtons = document.querySelectorAll('.vote-btn');

voteButtons.forEach(button => {
    button.addEventListener('click', async () => {
        const proposalId = button.getAttribute('data-proposal-id');
        const voteType = button.getAttribute('data-vote-type');
        const voteUrl = `/proposals/${proposalId}/vote/`;

        button.disabled = true;

        try {
            const response = await fetch(voteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: `vote_type=${voteType}`,
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if (data.success) {
                const card = button.closest('.proposal-card');
                const upButton = card.querySelector('.vote-up');
                const downButton = card.querySelector('.vote-down');

                upButton.querySelector('.vote-count').textContent = data.thumbs_up;
                downButton.querySelector('.vote-count').textContent = data.thumbs_down;

                upButton.classList.remove('active');
                downButton.classList.remove('active');

                if (data.user_vote === true) {
                    upButton.classList.add('active');
                } else if (data.user_vote === false) {
                    downButton.classList.add('active');
                }
            }
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            button.disabled = false;
        }
    });
});

function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }
    return '';
}
