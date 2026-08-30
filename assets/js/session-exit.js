import { t } from "./i18n.js";

// Shared pause / quit controls for timed question sessions and practical cases.
// - "Mettre en pause" saves progress and leaves.
// - "Quitter" opens a 3-choice dialog: continue / pause & save / quit for good.
// - while the session is running, navigating away triggers the browser guard.
export function installSessionExit({ container, isRunning, onPause, onQuit }) {
  if (!container || typeof document.createElement !== "function") {
    return { dispose() {} };
  }

  const pauseBtn = makeButton(t("Mettre en pause", "Pause"));
  const quitBtn = makeButton(t("Quitter", "Quit"));
  pauseBtn.addEventListener("click", () => run(onPause));
  quitBtn.addEventListener("click", openDialog);
  container.append(pauseBtn, quitBtn);

  const guard = (event) => {
    if (isRunning()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  if (typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", guard);
  }

  function openDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "exit-dialog";
    const heading = document.createElement("h2");
    heading.textContent = t("Une session est en cours. Que voulez-vous faire ?", "A session is in progress. What would you like to do?");
    const row = document.createElement("div");
    row.className = "button-row";

    const continueBtn = makeButton(t("Continuer", "Continue"), "button-primary");
    const pauseSaveBtn = makeButton(t("Mettre en pause et sauvegarder", "Pause and save"));
    const quitForGoodBtn = makeButton(t("Quitter définitivement", "Quit for good"));

    continueBtn.addEventListener("click", () => closeDialog(dialog));
    pauseSaveBtn.addEventListener("click", () => { closeDialog(dialog); run(onPause); });
    quitForGoodBtn.addEventListener("click", () => { closeDialog(dialog); run(onQuit); });

    row.append(continueBtn, pauseSaveBtn, quitForGoodBtn);
    dialog.append(heading, row);
    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  function run(handler) {
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("beforeunload", guard);
    }
    handler?.();
  }

  return {
    dispose() {
      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("beforeunload", guard);
      }
    },
  };
}

function makeButton(label, variant = "button-ghost") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button ${variant}`;
  button.textContent = label;
  return button;
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  dialog.remove?.();
}
