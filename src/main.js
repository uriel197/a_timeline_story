import { TimelineManager } from "./canvas-components/TimelineManager.js";
import { initDB } from "./db/db.js";
import { buildOriginContext } from "./db/db_logic/contextBuilder.js";
import { setupForm } from "./form/form.js";

let deferredPrompt; // For PWA install prompt

async function init() {
  try {
    // PWA Service Worker Registration
    if ("serviceWorker" in navigator) {
      // Skip Service Worker in development to avoid HMR conflicts
      if (import.meta.env.DEV) {
        console.log(
          "🧪 Development mode: Service Worker skipped for better HMR",
        );
      } else {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              console.log("✅ Production PWA Service Worker registered");
            })
            .catch((err) => {
              console.error("❌ Service Worker registration failed:", err);
            });
        });
      }
    }

    // PWA Install Prompt Handler
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log("✅ PWA Install prompt captured");
      showInstallButton();
    });

    // Open the Database
    const db = await initDB();

    // Initialize the Engine (Timeline)
    const canvas = document.getElementById("timeline-canvas");
    const manager = new TimelineManager(canvas, db);

    // Setup the Dashboard (Form)
    setupForm(document.getElementById("ui-layer"), db, manager);

    // Handle Window Events
    window.addEventListener("resize", () => manager.handleResize());
    manager.handleResize();

    try {
      const originContext = await buildOriginContext(db);
      await manager.executeContextBoot(originContext);
    } catch (contextError) {
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

function showInstallButton() {
  const installBtn = document.createElement("button");
  installBtn.className = "install-btn";
  installBtn.id = "install-pwa-btn";
  installBtn.textContent = "[ INSTALL APP ]";

  installBtn.onclick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log("User install choice:", outcome);
      deferredPrompt = null;
      installBtn.remove();
    }
  };

  document.body.appendChild(installBtn);
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
