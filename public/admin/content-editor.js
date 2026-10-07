// Compatibility boundary: the existing admin shell owns authentication/tabs;
// the React editor owns all form nodes and unsaved data inside the panel.
export function createContentEditor(api) {
  const panel = document.getElementById("panel-content");
  const ready = () =>
    panel.contentEditor
      ? Promise.resolve(panel.contentEditor)
      : new Promise((resolve) =>
          panel.addEventListener(
            "olga:content-ready",
            () => resolve(panel.contentEditor),
            { once: true },
          ),
        );
  return {
    async load(force = false) {
      return (await ready()).load(api, force);
    },
    dirty: () => panel.contentEditor?.dirty() || false,
    reset: () => panel.contentEditor?.reset(),
  };
}
