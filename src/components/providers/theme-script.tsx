export function ThemeScript() {
  const script = `
    (() => {
      try {
        const saved = localStorage.getItem("besa-theme");
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = saved || (systemDark ? "dark" : "light");
        document.documentElement.setAttribute("data-theme", theme);
      } catch (error) {
        document.documentElement.setAttribute("data-theme", "light");
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
