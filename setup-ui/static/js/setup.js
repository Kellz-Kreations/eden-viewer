(() => {
  function selectAll(textarea) {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("Clipboard API unavailable");
  }

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const button = target.closest("[data-copy-env]");
    if (!button) return;

    const textarea = document.getElementById("envText");
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    const originalLabel = button.textContent || "Copy";
    try {
      await copyToClipboard(textarea.value);
      button.textContent = "Copied";
    } catch {
      // Fallback: select text so the user can copy manually.
      selectAll(textarea);
      button.textContent = "Select to copy";
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1500);
  });
})();
