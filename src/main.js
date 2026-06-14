import { TimelineManager } from "./engine/TimelineManager";

const canvas = document.getElementById("timelineCanvas");
const manager = new TimelineManager(canvas);

window.addEventListener("resize", () => manager.handleResize());

window.zoomBack = () => manager.zoomBack();

function loop() {
  manager.update();
  manager.render();
  requestAnimationFrame(loop);
}

async function init() {
  manager.handleResize(); // Set initial size
  await manager.pushLevel(0); // Load first level
  loop();
}

init();
