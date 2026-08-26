// shadcn's dark-mode tokens are gated behind a `.dark` class (see
// @custom-variant dark in index.css), not the media query directly. There's
// no manual theme toggle in this app, so just keep the class in sync with
// the OS preference.
export function initTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = (isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
  };

  apply(media.matches);
  media.addEventListener("change", (e) => apply(e.matches));
}
