import { Timeline } from "./engine/Timeline";

const canvas = document.getElementById("timelineCanvas");

resizeCanvas(); // set size initially

const timeline = new Timeline(null, canvas);

timeline.animation.applyEntryEffect(timeline);

// This fires when the camera zooms into a segment
timeline.onFocusReached = (segmentData) => {
  setTimeout(() => {
    const infoDiv = document.getElementById("infoCard");
    infoDiv.classList.add("visible");
    infoDiv.innerHTML = `
    <h3>Segment ${segmentData.index}</h3>
    <p>General information about this era...</p>
    <button onclick="goDeeper()">Go Deeper</button>
  `;
  }, 1000);
};

timeline.onBlur = () => {
  infoCard.classList.remove("visible");
};

// This function will be called by your HTML button
window.goDeeper = () => {
  const infoDiv = document.getElementById("infoCard");
  infoDiv.classList.remove("visible");

  // Tell the timeline to proceed to Phase 3 (the child level)
  timeline.proceedToChild();
};

// Optional controls
window.stepBack = () => timeline.animation.stepBack(timeline);

// Set initial size based on window width
function resizeCanvas() {
  canvas.width = window.innerWidth * 0.9; // 90% of screen width
  canvas.height = 300; // or any fixed height you want
}

window.addEventListener("resize", () => {
  resizeCanvas();
  timeline.reset(); // optional: reset camera so timeline scales properly
});
