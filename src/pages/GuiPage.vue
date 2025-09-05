<script setup>
import { onMounted, onUpdated, ref, computed } from "vue";
import { useHydraStore } from "@/stores/hydra";
import { useModalStore } from "@/stores/modal";

import { getSafeLocalStorage, setSafeLocalStorage } from "@/utils";
import { deepCopy } from "@/utils/object-utils";

import { CURRENT_VERSION, INITIAL_BLOCKS, TYPE_SRC } from "@/constants";

import NavigationPanel from "@/components/NavigationPanel";
import ParentBlock from "@/components/ParentBlock";
import ModalRenderer from "@/components/ModalRenderer";

import Toaster from "@/components/ui/toast/Toaster";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const store = useHydraStore();
const modalStore = useModalStore();

const prevBlocks = ref(null);
const movedBlockCoordinates = ref({ x: 0, y: 0 });
const areBlocksHidden = ref(false);
const addBlockModalParent = ref(null);

// Use modal store's computed property
const isAnyModalOpen = computed(() => modalStore.isAnyModalOpen);

// set up keyboard shortcuts
const onKeyDown = (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (!store.isInputFocused) {
      const isUndo = e.keyCode === 90 && !e.shiftKey;
      const isRedo = e.keyCode === 89 || (e.keyCode === 90 && e.shiftKey);
      const isCopy = e.keyCode === 67;
      const isCut = e.keyCode === 88;
      const isPaste = e.keyCode === 86;

      if (isUndo || isRedo || isCopy || isCut || isPaste) {
        e.preventDefault();
      }

      if (isUndo) return store.undoRedo(1);
      if (isRedo) return store.undoRedo(-1);
      if (isCopy) return store.copyBlock(false);
      if (isCut) return store.copyBlock(true);
      if (isPaste) return store.pasteBlock();
    }
  }

  if (e.key === "Escape" && !isAnyModalOpen.value) {
    return toggleFullscreen();
  }

  if (e.key === "Enter" && store.isInputFocused) {
    return handleChange(true);
  }
};

onMounted(() => {
  // show welcome modal
  if (
    !getSafeLocalStorage("welcomeModalLastUpdate") ||
    getSafeLocalStorage("welcomeModalLastUpdate") < CURRENT_VERSION
  ) {
    modalStore.openModal("welcome");
  }

  // Initialize scenes (this will convert legacy data if needed)
  store.initializeScenes();

  // Load current scene data
  const currentScene = store.currentScene;
  if (currentScene) {
    const sceneData = {
      blocks: currentScene.blocks || [],
      externalSourceBlocks: currentScene.externalSourceBlocks || [],
      synthSettings: currentScene.synthSettings,
    };

    // Ensure all blocks have a z-index and colorId property
    [...sceneData.blocks, ...sceneData.externalSourceBlocks].forEach(
      (block, index) => {
        if (!block.zIndex) {
          block.zIndex = index + 1;
        }
        if (!block.colorId) {
          block.colorId = index;
        }
      },
    );

    store.loadSceneData(sceneData);
  } else {
    // Fallback to initial blocks if no scene is available
    const sceneData = {
      blocks: INITIAL_BLOCKS,
      externalSourceBlocks: [],
      synthSettings: null,
    };

    // Ensure all blocks have a z-index and colorId property
    sceneData.blocks.forEach((block, index) => {
      if (!block.zIndex) {
        block.zIndex = index + 1;
      }
      if (!block.colorId) {
        block.colorId = index;
      }
    });

    store.loadSceneData(sceneData);
  }

  document.addEventListener("keydown", onKeyDown);
});

onUpdated(() => {
  moveAllBlocks();

  prevBlocks.value = [
    ...deepCopy(store.blocks),
    ...deepCopy(store.externalSourceBlocks),
  ];
});

const toggleFullscreen = () => (areBlocksHidden.value = !areBlocksHidden.value);

const moveAllBlocks = () => {
  // move source blocks to their positions
  store.blocks.forEach((block, index) => {
    moveBlock(null, index, block.type, block.position);
    // Also set z-index when positioning
    const div = document.getElementById(`${block.type}-${index}`);
    if (div && block.zIndex) {
      div.style.zIndex = block.zIndex;
    }
  });
  store.externalSourceBlocks.forEach((block, index) => {
    moveBlock(null, index, block.type, block.position);
    // Also set z-index when positioning
    const div = document.getElementById(`${block.type}-${index}`);
    if (div && block.zIndex) {
      div.style.zIndex = block.zIndex;
    }
  });
};

const moveBlock = (e, index, type, position) => {
  let div;
  let positionChanged = false;

  div = document.getElementById(`${type}-${index}`);

  if (e) {
    // Calculate the highest z-index among all blocks
    const allBlocks = [...store.blocks, ...store.externalSourceBlocks];
    const maxZIndex = Math.max(
      0,
      ...allBlocks.map((block) => block.zIndex || 0),
    );
    const newZIndex = maxZIndex + 1;

    div.style.zIndex = newZIndex;
    store.setBlockZIndex({ index, type, zIndex: newZIndex });

    if (type === TYPE_SRC) {
      store.setFocus(store.blocks[index]);
    }
  }

  if (position) {
    return (div.style.transform = `translate(${position.x}px, ${position.y}px)`);
  }

  if (e.type === "touchstart") {
    e.preventDefault();
    e = e.touches[0];
  }

  const divRect = div.getBoundingClientRect();

  const offsetX = e.clientX - divRect.left - window.scrollX;
  const offsetY = e.clientY - divRect.top - window.scrollY;

  const x = e.clientX - offsetX;
  const y = e.clientY - offsetY;

  movedBlockCoordinates.value = { x, y };

  const move = (e) => {
    if (e.type === "touchmove") {
      e.preventDefault();
      e = e.touches[0];
    }

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    if (x <= 0) x = 0;
    if (y <= 48) y = 48;

    movedBlockCoordinates.value = { x, y };
    div.style.transform = `translate(${x}px, ${y}px)`;

    // not ultimately true, but the chance of moving the block to the exact same position is low
    positionChanged = true;
  };

  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);

    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", up);

    if (positionChanged) {
      store.setBlockPosition({
        index,
        type,
        position: movedBlockCoordinates.value,
      });
    }
  };

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);

  document.addEventListener("touchmove", move);
  document.addEventListener("touchend", up);
};

const handleChange = (isEnterKey = false) => {
  if (!isEnterKey) store.setInputFocus(false);
  const newBlocks = [...store.blocks, ...store.externalSourceBlocks];
  if (JSON.stringify(newBlocks) === JSON.stringify(prevBlocks.value)) return;
  store.setBlocks({ blocks: newBlocks });
  prevBlocks.value = deepCopy(newBlocks);
};

const canPasteOnPlayground = computed(() => store.copied?.type === TYPE_SRC);

const pasteOnPlayground = () => {
  store.setFocus(null);
  store.pasteBlock();
};

const openAddBlockModal = (parent = null) => {
  store.setFocus(parent);
  addBlockModalParent.value = parent;
  modalStore.openModal("addBlock", { parent });
};

const handleWelcomeModalClose = () => {
  modalStore.closeModal("welcome");
  setSafeLocalStorage("welcomeModalLastUpdate", CURRENT_VERSION);
};

const switchToScene = (sceneId) => {
  // Save current scene data before switching
  store.updateCurrentScene({
    blocks: [...store.blocks],
    externalSourceBlocks: [...store.externalSourceBlocks],
    synthSettings: { ...store.synthSettings },
  });

  const scene = store.switchToScene(sceneId);
  if (scene) {
    // Load scene data using the store method
    const sceneData = {
      blocks: scene.blocks || [],
      externalSourceBlocks: scene.externalSourceBlocks || [],
      synthSettings: scene.synthSettings,
    };

    // Ensure all blocks have a z-index and colorId property
    [...sceneData.blocks, ...sceneData.externalSourceBlocks].forEach(
      (block, index) => {
        if (!block.zIndex) {
          block.zIndex = index + 1;
        }
        if (!block.colorId) {
          block.colorId = index;
        }
      },
    );

    store.loadSceneData(sceneData);
  }
};
</script>

<template>
  <Transition name="modal">
    <div v-if="isAnyModalOpen">
      <ModalRenderer
        v-if="modalStore.getModalState('welcome')"
        modal-name="welcome"
        @close="handleWelcomeModalClose"
      />
      <ModalRenderer
        v-if="modalStore.getModalState('three')"
        modal-name="three"
      />
      <ModalRenderer
        v-if="modalStore.getModalState('settings')"
        modal-name="settings"
      />
      <ModalRenderer
        v-if="modalStore.getModalState('renameScene')"
        modal-name="renameScene"
      />

      <!-- AddBlock modal needs special parent handling, so keep it separate -->
      <ModalRenderer
        v-if="modalStore.getModalState('addBlock')"
        modal-name="addBlock"
      />
    </div>
  </Transition>

  <ContextMenu>
    <ContextMenuTrigger @click="store.setFocus(null)">
      <div class="playground" @click="store.setFocus(null)" />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem @click="openAddBlockModal()">New source</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem
        :checked="areBlocksHidden"
        @click="toggleFullscreen"
      >
        Hide UI
        <ContextMenuShortcut>Esc</ContextMenuShortcut>
      </ContextMenuCheckboxItem>
      <ContextMenuSeparator v-if="canPasteOnPlayground" />
      <ContextMenuItem v-if="canPasteOnPlayground" @click="pasteOnPlayground">
        Paste
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>

  <Transition name="nav">
    <NavigationPanel
      v-show="!areBlocksHidden"
      @open-add-block-modal="openAddBlockModal"
      @toggle-fullscreen="toggleFullscreen"
      @switch-to-scene="switchToScene"
    />
  </Transition>

  <div v-show="!areBlocksHidden">
    <ParentBlock
      v-for="(block, index) in store.blocks"
      :key="index"
      :index="index"
      :block="block"
      :handle-change="handleChange"
      :move-block="moveBlock"
      :open-add-block-modal="openAddBlockModal"
    />

    <ParentBlock
      v-for="(block, index) in store.externalSourceBlocks"
      :key="index"
      :index="index"
      :block="block"
      :handle-change="handleChange"
      :move-block="moveBlock"
    />
  </div>

  <Toaster />
</template>

<style lang="scss" scoped>
.playground {
  position: fixed;
  z-index: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.modal-enter-active,
.modal-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.nav-enter-active,
.nav-leave-active {
  transition: transform 0.2s ease;
}

.nav-enter-from,
.nav-leave-to {
  transform: translateY(-48px);
}
</style>
