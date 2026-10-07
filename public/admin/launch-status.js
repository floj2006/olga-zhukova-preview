// Authentication remains owned by the existing shell; React owns the status UI.
export function createLaunchStatus(api) {
  const panel = document.getElementById("launch-status");
  let generation = 0;
  return {
    async load() {
      const seq = ++generation;
      const controller =
        panel.launchStatus ||
        (await new Promise((resolve) =>
          panel.addEventListener(
            "olga:launch-ready",
            () => resolve(panel.launchStatus),
            { once: true },
          ),
        ));
      if (seq === generation) await controller?.load(api);
    },
    reset() {
      generation++;
      panel.launchStatus?.reset();
    },
  };
}
