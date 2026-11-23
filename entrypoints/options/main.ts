const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="wikipedia"]'));
const status = document.getElementById('status')!;

const { wikipedia = 'ask' } = await browser.storage.local.get('wikipedia');
for (const radio of radios) {
  radio.checked = radio.value === wikipedia;
  radio.addEventListener('change', async () => {
    await browser.storage.local.set({ wikipedia: radio.value });
    status.textContent = 'Saved.';
  });
}
