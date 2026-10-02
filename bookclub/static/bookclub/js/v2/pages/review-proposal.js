document.addEventListener('DOMContentLoaded', function() {
    const approveRadio = document.getElementById('id_action_0');
    const rejectRadio = document.getElementById('id_action_1');
    const rejectionReasonDiv = document.getElementById('rejectionReasonDiv');
    const approvalOptionsDiv = document.getElementById('approvalOptionsDiv');

    function updateVisibility() {
        if (rejectRadio && rejectRadio.checked) {
            rejectionReasonDiv.classList.remove('hidden');
            approvalOptionsDiv.classList.add('hidden');
        } else if (approveRadio && approveRadio.checked) {
            rejectionReasonDiv.classList.add('hidden');
            approvalOptionsDiv.classList.remove('hidden');
        } else {
            rejectionReasonDiv.classList.add('hidden');
            approvalOptionsDiv.classList.add('hidden');
        }
    }

    if (approveRadio && rejectRadio) {
        approveRadio.addEventListener('change', updateVisibility);
        rejectRadio.addEventListener('change', updateVisibility);
        updateVisibility();
    }
});
