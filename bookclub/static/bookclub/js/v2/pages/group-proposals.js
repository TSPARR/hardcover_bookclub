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
