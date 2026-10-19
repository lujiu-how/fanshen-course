document.querySelectorAll('.week-panel').forEach((panel) => {
  panel.addEventListener('toggle', () => {
    if (!panel.open) return;
    document.querySelectorAll('.week-panel').forEach((other) => {
      if (other !== panel) other.open = false;
    });
  });
});
