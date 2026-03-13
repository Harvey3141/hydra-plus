<script setup>
import { onMounted, onUnmounted } from "vue";

// import { onMIDISuccess, onMIDIFailure } from "@/utils/midi-utils";

let ws = null;
const connectRelay = () => {
  ws = new WebSocket(`ws://${window.location.hostname}:3001`);
  ws.addEventListener("open", () =>
    console.log("[hydra-plus] visualizer relay connected"),
  );
  ws.addEventListener("message", (event) => {
    console.log("[hydra-plus] visualizer received:", event.data);
    if (event.data) window.eval(event.data);
  });
  ws.addEventListener("close", () => {
    ws = null;
    setTimeout(connectRelay, 3000);
  });
  ws.addEventListener("error", () => {});
};

onMounted(() => connectRelay());
onUnmounted(() => {
  if (ws) ws.close();
});

// onMounted(() => {
//   navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
// });
</script>
