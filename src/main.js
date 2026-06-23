import { TimelineManager } from "./canvas-components/TimelineManager.js";
import { initDB } from "./db/db.js";
import { buildOriginContext } from "./db/db_logic/contextBuilder.js";
import { setupForm } from "./form/form.js";

async function init() {
  try {
    // Open the Database
    const db = await initDB();

    // Initialize the Engine (Timeline)
    const canvas = document.getElementById("timeline-canvas");
    const manager = new TimelineManager(canvas, db);

    // Setup the Dashboard (Form)
    setupForm(document.getElementById("ui-layer"), db, manager);

    // Handle Window Events (Standard Mechanic maintenance)
    window.addEventListener("resize", () => manager.handleResize());

    manager.handleResize();

    try {
      const originContext = await buildOriginContext(db);
      // Fire the orchestrated camera swoop and terminal cascade
      await manager.executeContextBoot(originContext);
    } catch (contextError) {
      // If buildOriginContext throws "No Origin node found", setupForm handles it
      console.warn(
        "System Origin not established yet. Awaiting form submission.",
        contextError,
      );
    }

    startAnimationLoop(manager);
  } catch (error) {
    console.error("Application boot failed:", error);
  }
}

function startAnimationLoop(manager) {
  function loop() {
    manager.update();
    manager.render();
    requestAnimationFrame(loop);
  }
  loop();
}

init();
