// Caixas de código: botão "Copiar" em todos os .code-box (o texto copiado é o do <pre> dentro da caixa)
document.addEventListener('click', async e => {
  const button = e.target.closest('.btn-copy');
  if (!button) return;
  const code = button.closest('.code-box').querySelector('pre').textContent;
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copiado ✓';
  } catch {
    button.textContent = 'Não deu para copiar';
  }
  setTimeout(() => { button.textContent = 'Copiar'; }, 1500);
});
