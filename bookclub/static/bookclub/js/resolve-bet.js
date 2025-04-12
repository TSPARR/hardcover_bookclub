/**
 * JavaScript for the resolve_dollar_bet form
 * Handles the dynamic display of winner selection options based on the resolution type
 */

document.addEventListener('DOMContentLoaded', function() {
    const resolveWinLoss = document.getElementById('resolveWinLoss');
    const resolveInconclusive = document.getElementById('resolveInconclusive');
    const winnerSelectionSection = document.getElementById('winnerSelectionSection');
    
    function updateFormVisibility() {
      if (resolveWinLoss.checked) {
        winnerSelectionSection.style.display = 'block';
        document.querySelectorAll('input[name="winner"]').forEach(input => {
          input.required = true;
        });
      } else {
        winnerSelectionSection.style.display = 'none';
        document.querySelectorAll('input[name="winner"]').forEach(input => {
          input.required = false;
        });
      }
    }
    
    resolveWinLoss.addEventListener('change', updateFormVisibility);
    resolveInconclusive.addEventListener('change', updateFormVisibility);
    
    // Initial setup
    updateFormVisibility();
  });