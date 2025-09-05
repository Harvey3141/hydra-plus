<script setup>
import { computed } from "vue";
import { useHydraStore } from "@/stores/hydra";
import { useModalStore } from "@/stores/modal";
import { MODIFIER_KEY, TYPE_COMPLEX, TYPE_EXTERNAL } from "@/constants";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { Pencil, X } from "lucide-vue-next";

import { useToast } from "@/components/ui/toast/use-toast";
const { toast } = useToast();

// // @todo: losing window focus breaks the beat counter
// let beatHappened = false;
// let beatCounter = 0;
// let lastBeatTime = 1; // so that the first beat is always logged
// const beatLogInterval = 4;

// // eslint-disable-next-line no-undef
// update = () => {
//   const { bpm, fps, time } = window.hydra;
//   const beatInterval = 60 / bpm;
//   const frameInterval = 1 / fps;
//   const timeSinceLastBeat = time % beatInterval;

//   if (timeSinceLastBeat < lastBeatTime && !beatHappened) {
//     beatHappened = true;
//     beatCounter += 1;

//     if (beatCounter === beatLogInterval) {
//       beatCounter = 0;
//       // console.warn("beat");
//     }
//   }

//   lastBeatTime = timeSinceLastBeat;

//   if (timeSinceLastBeat > frameInterval) {
//     beatHappened = false;
//   }
// };

const store = useHydraStore();
const modalStore = useModalStore();

const emit = defineEmits([
  "openAddBlockModal",
  "toggleFullscreen",
  "switchToScene",
]);

// const waitingForBeat = ref(false);

const handleSend = () => {
  // if (!this.waitingForBeat) {
  //   this.waitingForBeat = true;
  //   const checkInterval = setInterval(() => {
  //     if (beatCounter === 0) {
  //       clearInterval(checkInterval);
  //       this.waitingForBeat = false;
  //       this.send();
  //     }
  //   }, 10);
  // }

  store.send();
};

const openAddBlockModal = () => {
  modalStore.openModal("addBlock");
};

const isAddEffectModalDisabled = computed(() => {
  const { focused } = store;
  return (
    !focused ||
    (focused.type === TYPE_COMPLEX && focused.blocks.length > 0) ||
    focused.type === TYPE_EXTERNAL
  );
});

const openAddEffectModal = () => {
  modalStore.openModal("addBlock", { parent: store.focused });
};

const openVisualizerPage = () => {
  window.open("/visualizer", "_blank");
};

const openSettingsModal = () => {
  modalStore.openModal("settings");
};

const goFullscreen = () => {
  emit("toggleFullscreen");

  toast({
    title: "Entered fullscreen mode",
    description: "Press Esc or right click to exit",
  });
};

const handleSceneChange = (sceneId) => {
  emit("switchToScene", sceneId);
};

const createNewScene = () => {
  const newScene = store.createScene();
  emit("switchToScene", newScene.id);

  toast({
    title: "New scene created",
    description: `Scene "${newScene.name}" has been created`,
  });
};

const deleteScene = (sceneId, event) => {
  event.stopPropagation();

  if (store.scenes.length <= 1) {
    toast({
      title: "Cannot delete scene",
      description: "You must have at least one scene",
      variant: "destructive",
    });
    return;
  }

  const scene = store.scenes.find((s) => s.id === sceneId);
  if (!scene) return;

  // Store the scene name before deletion for the toast
  const sceneName = scene.name;

  const success = store.deleteScene(sceneId);
  if (success) {
    toast({
      title: "Scene deleted",
      description: `Scene "${sceneName}" has been deleted`,
    });
  }
};

const openRenameSceneModal = (sceneId, event) => {
  event.stopPropagation();
  modalStore.openModal("renameScene", { sceneId });
};
</script>

<template>
  <div
    class="fixed z-[99] flex w-full p-1.5 backdrop-blur-[6px] bg-[#151515dd]"
  >
    <Menubar class="border-none rounded-none bg-transparent">
      <MenubarMenu value="scene">
        <MenubarTrigger>
          {{ store.currentScene?.name || "Select Scene" }}
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            v-for="scene in store.scenes"
            :key="scene.id"
            class="flex items-center justify-between"
            @click="handleSceneChange(scene.id)"
          >
            <span class="flex-1">{{ scene.name }}</span>
            <div class="flex items-center">
              <button
                class="ml-2 text-gray-400 hover:text-gray-300"
                title="Rename scene"
                @click.stop="openRenameSceneModal(scene.id, $event)"
              >
                <Pencil title="Rename scene" class="w-4 h-4" />
              </button>
              <button
                v-if="store.scenes.length > 1"
                class="ml-2 text-red-400 hover:text-red-300"
                title="Delete scene"
                @click.stop="deleteScene(scene.id, $event)"
              >
                <X title="Delete scene" class="w-4 h-4" />
              </button>
            </div>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            class="text-green-400 hover:text-green-300"
            @click="createNewScene"
          >
            + New Scene
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu value="new">
        <MenubarTrigger>New</MenubarTrigger>
        <MenubarContent>
          <MenubarItem @click="openAddBlockModal"> Source </MenubarItem>
          <MenubarItem
            :disabled="isAddEffectModalDisabled"
            @click="openAddEffectModal"
          >
            Effect
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu value="edit">
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem :disabled="!store.canUndo" @click="store.undoRedo(1)">
            Undo
            <MenubarShortcut>{{ MODIFIER_KEY }}Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem :disabled="!store.canRedo" @click="store.undoRedo(-1)">
            Redo
            <MenubarShortcut>{{ MODIFIER_KEY }}Y</MenubarShortcut>
          </MenubarItem>

          <MenubarSeparator />

          <MenubarItem
            :disabled="!store.focused"
            @click="store.copyBlock(true)"
          >
            Cut
            <MenubarShortcut>{{ MODIFIER_KEY }}X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            :disabled="!store.focused"
            @click="store.copyBlock(false)"
          >
            Copy
            <MenubarShortcut>{{ MODIFIER_KEY }}C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem :disabled="!store.canPaste" @click="store.pasteBlock">
            Paste
            <MenubarShortcut> {{ MODIFIER_KEY }}V </MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu value="view">
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem @click="openVisualizerPage">Visualizer</MenubarItem>
          <MenubarItem @click="openSettingsModal"> Settings </MenubarItem>
          <MenubarSeparator />
          <MenubarItem @click="goFullscreen">
            Toggle Fullscreen
            <MenubarShortcut> Esc </MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <Button
      variant="outline"
      class="flex ml-auto border-red-600 bg-transparent"
      @click="handleSend"
    >
      Send
    </Button>
  </div>
</template>
