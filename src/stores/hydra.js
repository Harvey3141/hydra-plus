import { defineStore } from "pinia";
import { ref, computed, reactive } from "vue";
import { useBroadcastChannel } from "@vueuse/core";
import { deepCopy, flatten, flattenExternal } from "@/utils/object-utils";
import {
  setSafeLocalStorage,
  getSafeLocalStorage,
  showErrorToast,
  setHueLights,
} from "@/utils";
import {
  INITIAL_BLOCKS,
  MAX_NUMBER_OF_SOURCES,
  MAX_NUMBER_OF_EXTERNALS,
  TYPE_SRC,
  TYPE_THREE,
  TYPE_EXTERNAL,
  TYPE_SIMPLE,
  TYPE_COMPLEX,
  DEFAULT_POSITION,
} from "@/constants";

export const useHydraStore = defineStore("hydra", () => {
  // State
  const r = ref(0);
  const g = ref(0);
  const b = ref(0);
  const focused = ref(null);
  const focusedParent = ref(null);
  const isInputFocused = ref(false);
  const blocks = ref([]);
  const externalSourceBlocks = ref([]);
  const synthSettings = reactive({
    output: 0,
    bpm: 120,
    speed: 1,
    resolution: 100,
    fps: 60,
  });
  const codeString = ref("");
  const history = ref([]);
  const historyIndex = ref(0);
  const canUndo = computed(() => historyIndex.value < history.value.length - 1);
  const canRedo = computed(() => historyIndex.value > 0);
  const copied = ref(null);
  const copiedParent = ref(null);
  const isCut = ref(false);

  // Scenes state
  const scenes = ref([]);
  const currentSceneId = ref(null);

  const { post } = useBroadcastChannel({ name: "hydra-plus-channel" });

  // Actions
  const updateRGB = ({ red, green, blue }) => {
    r.value = red;
    g.value = green;
    b.value = blue;
    update({ shouldSetHistory: false });
  };

  const setFocus = (focus, parent) => {
    // @todo merge the two states into one
    focused.value = focus;
    focusedParent.value = parent;
  };

  const setInputFocus = (isFocused) => {
    // console.log("inputFocus", isFocused);
    isInputFocused.value = isFocused;
  };

  const addParent = (source, shouldSetHistory = true, isPasting = false) => {
    const copiedSource = deepCopy(source);

    if (
      source.type === TYPE_SRC &&
      blocks.value.length >= MAX_NUMBER_OF_SOURCES
    ) {
      showErrorToast(
        `You can't add more than ${MAX_NUMBER_OF_SOURCES} sources.`,
      );
      return false;
    }

    if (
      (source.type === TYPE_EXTERNAL || source.type === TYPE_THREE) &&
      externalSourceBlocks.value.length >= MAX_NUMBER_OF_EXTERNALS
    ) {
      showErrorToast(
        `You can't add more than ${MAX_NUMBER_OF_EXTERNALS} externals.`,
      );
      return false;
    }

    if (isPasting && !canPasteParent.value) {
      showErrorToast(
        `Can't paste here: inserting "${copiedSource.name}" into "${focused.value?.name}".`,
      );
      return false;
    }

    // Calculate the highest z-index among all blocks for the new block
    const allBlocks = [...blocks.value, ...externalSourceBlocks.value];
    const maxZIndex = Math.max(
      0,
      ...allBlocks.map((block) => block.zIndex || 0),
    );

    // Assign a rotating color ID based on existing blocks
    const existingColorIds = allBlocks.map((block) => block.colorId || 0);
    const maxColorId = Math.max(0, ...existingColorIds);
    const nextColorId = maxColorId + 1;

    const newBlock = {
      ...copiedSource,
      position: window.contextMenuPosition
        ? {
            x: window.contextMenuPosition.x - 180,
            y: window.contextMenuPosition.y - 20,
          }
        : DEFAULT_POSITION,
      zIndex: maxZIndex + 1,
      colorId: nextColorId,
    };

    window.contextMenuPosition = null;

    if (source.type === TYPE_SRC) {
      blocks.value.push(newBlock);
    } else {
      externalSourceBlocks.value.push(newBlock);
    }

    setFocus(newBlock);

    synthSettings.output = blocks.value.length - 1;

    if (source.type === TYPE_EXTERNAL) {
      const addedExternal = flattenExternal(
        copiedSource,
        externalSourceBlocks.value.length - 1,
      );
      eval(addedExternal);
      post(addedExternal);
    } else {
      setBlocks({
        blocks: [...blocks.value, ...externalSourceBlocks.value],
        shouldSetHistory,
      });
    }

    return true;
  };

  const addChild = (effect, shouldSetHistory = true, isPasting = false) => {
    if (!isPasting || canPasteChild.value) {
      focused.value.blocks.push(deepCopy(effect));
    } else if (focusedParent.value && canPasteChildToParent.value) {
      focusedParent.value.blocks.push(deepCopy(effect));
    } else if (!focusedParent.value) {
      return addParent(effect, shouldSetHistory, isPasting);
    } else {
      showErrorToast(
        `Can't paste here: inserting "${copied.value.name}" into "${focused.value.name}".`,
      );
      return false;
    }

    if (effect.type === TYPE_COMPLEX && effect.blocks.length === 0) {
      setFocus(focused.value.blocks[focused.value.blocks.length - 1]);
    }

    setBlocks({
      blocks: [...blocks.value, ...externalSourceBlocks.value],
      shouldSetHistory,
    });

    return true;
  };

  const setBlocks = ({ blocks: newBlocks, shouldSetHistory = true }) => {
    const newSrcBlocks = newBlocks.filter((block) => block.type === TYPE_SRC);
    const newExternalBlocks = newBlocks.filter((block) =>
      [TYPE_EXTERNAL, TYPE_THREE].includes(block.type),
    );

    blocks.value = newSrcBlocks;
    externalSourceBlocks.value = newExternalBlocks;
    update({ shouldSetHistory });
  };

  const loadSceneData = (sceneData) => {
    const {
      blocks: sceneBlocks = [],
      externalSourceBlocks: sceneExternalBlocks = [],
      synthSettings: sceneSynthSettings,
    } = sceneData;

    blocks.value.length = 0;
    externalSourceBlocks.value.length = 0;

    history.value.length = 0;
    historyIndex.value = 0;

    blocks.value.push(...sceneBlocks);
    externalSourceBlocks.value.push(...sceneExternalBlocks);

    if (sceneSynthSettings) {
      Object.assign(synthSettings, sceneSynthSettings);
    }

    update();
  };

  const setBlockPosition = ({ index, type, position }) => {
    let blockPosition;

    if (type === TYPE_SRC) {
      blockPosition = blocks.value[index].position;
      blocks.value[index].position = position;
    } else {
      blockPosition = externalSourceBlocks.value[index].position;
      externalSourceBlocks.value[index].position = position;
    }

    // If the block hasn't moved, don't set history
    if (
      Math.abs(blockPosition.x - position.x) < 50 ||
      Math.abs(blockPosition.y - position.y) < 50
    ) {
      return;
    }

    setHistory();
  };

  const setBlockZIndex = ({ index, type, zIndex }) => {
    if (type === TYPE_SRC) {
      blocks.value[index].zIndex = zIndex;
    } else {
      externalSourceBlocks.value[index].zIndex = zIndex;
    }
  };

  const deleteParent = ({ type, index }) => {
    if (type === TYPE_SRC) {
      blocks.value.splice(index, 1);
    } else {
      externalSourceBlocks.value.splice(index, 1);
    }

    if (!blocks.value[synthSettings.output] && blocks.value.length > 0) {
      synthSettings.output = blocks.value.length - 1;
    }

    setBlocks({
      blocks: [...blocks.value, ...externalSourceBlocks.value],
      shouldSetHistory: true,
      isDelete: true,
    });
  };

  const deleteChild = ({ element, parent }, ignoreFocus) => {
    const stack = parent.blocks ? [parent.blocks] : [];

    while (stack.length) {
      const currentArray = stack.pop();
      for (let i = currentArray.length - 1; i >= 0; i--) {
        if (currentArray[i] === element) {
          if (!ignoreFocus) setFocus(parent);

          currentArray.splice(i, 1);

          setBlocks({
            blocks: [...blocks.value, ...externalSourceBlocks.value],
          });

          return;
        }

        if (currentArray[i].blocks) {
          stack.push(currentArray[i].blocks);
        }
      }
    }
  };

  const update = (
    { shouldSetHistory } = {
      shouldSetHistory: true,
    },
  ) => {
    const isHuePluginEnabled = false && process.env.NODE_ENV !== "production";
    let newCodeString = "";

    if (blocks.value.length === 0) {
      newCodeString = "hush()";
    } else {
      if (!blocks.value[synthSettings.output]) {
        synthSettings.output = 0;
      }

      for (const [i, block] of externalSourceBlocks.value.entries()) {
        if (block.type !== TYPE_THREE && block.name !== "initScreen") {
          newCodeString += flattenExternal(block, i);
        }
      }

      if (isHuePluginEnabled) {
        setHueLights({ r: r.value, g: g.value, b: b.value });
      }

      for (const [i, block] of blocks.value.entries()) {
        newCodeString += `${flatten(block)}`;

        if (isHuePluginEnabled) {
          newCodeString += `.color(${r.value}, ${g.value}, ${b.value}, 1)`;
        }

        newCodeString += `.out(o${i})\n`;
      }

      newCodeString += `window.hydra.render(o${synthSettings.output})`;
    }

    document.getElementById("hydra-canvas");

    try {
      eval(newCodeString);
      codeString.value = newCodeString;
    } catch (error) {
      showErrorToast(error);
    }

    if (shouldSetHistory) setHistory();
  };

  const send = () => {
    if (codeString.value) {
      post(codeString.value);

      updateCurrentScene({
        blocks: blocks.value,
        externalSourceBlocks: externalSourceBlocks.value,
        synthSettings: synthSettings,
      });

      saveScenes();
    }
  };

  const setSynthSettings = (settings) => {
    eval(`bpm = ${settings.bpm}`);
    post(`bpm = ${settings.bpm}`);
    eval(`speed = ${settings.speed}`);
    post(`speed = ${settings.speed}`);

    const multiplier = (settings.resolution * window.devicePixelRatio) / 100;
    const resolutionString = `setResolution(
        ${window.outerHeight * multiplier},
        ${window.outerWidth * multiplier}
      )`;

    eval(resolutionString);
    post(resolutionString);

    eval(`fps = ${settings.fps}`);
    post(`fps = ${settings.fps}`);

    Object.assign(synthSettings, settings);

    updateCurrentScene({
      synthSettings: synthSettings,
    });

    saveScenes();
  };

  const setOutput = (output) => {
    if (synthSettings.output === output) return;

    synthSettings.output = output;
    update({ shouldSetHistory: false });
  };

  // History

  const setHistory = () => {
    if (history.value.length > 99) history.value.pop();

    history.value.splice(0, historyIndex.value);
    history.value.unshift(
      deepCopy({
        blocks: blocks.value,
        externalSourceBlocks: externalSourceBlocks.value,
      }),
    );

    historyIndex.value = 0;

    // console.log(history.value[historyIndex.value]?.blocks);
  };

  /**
   * @param {Number} direction 1 for undo, -1 for redo
   */
  const undoRedo = (direction) => {
    const newIndex = historyIndex.value + direction;
    if (newIndex < 0 || newIndex >= history.value.length) return;

    historyIndex.value = newIndex;
    const historyState = history.value[newIndex];

    setBlocks({
      blocks: deepCopy([
        ...historyState.blocks,
        ...historyState.externalSourceBlocks,
      ]),
      shouldSetHistory: false,
    });

    // console.log(history.value[historyIndex.value]?.blocks);
  };

  // Copy & paste

  const copyBlock = (cutting = false) => {
    if (!focused.value) return;

    copied.value = focused.value;
    copiedParent.value = focusedParent.value;

    isCut.value = cutting;
  };

  const resetCut = () => {
    copiedParent.value = null;
    isCut.value = false;
  };

  const pasteBlock = () => {
    if (!copied.value) return;

    if (copied.value?.position) {
      // Parent block is pasted
      const pasted = performPaste();

      if (pasted && isCut.value) {
        const copiedIndex = blocks.value.findIndex(
          (block) => block === copied.value,
        );

        deleteParent({ type: copied.value.type, index: copiedIndex });

        resetCut();
      }
    } else {
      // Child block is pasted
      const pasted = performPaste();

      if (pasted && isCut.value) {
        deleteChild(
          {
            element: copied.value,
            parent: copiedParent.value,
          },
          isCut.value,
        );

        resetCut();
      }
    }
  };

  const canPasteChildToTarget = (target) =>
    (target &&
      target !== copied.value &&
      target.type === TYPE_SRC &&
      (copied.value?.type === TYPE_SIMPLE ||
        copied.value?.type === TYPE_COMPLEX)) ||
    (target &&
      target.type === TYPE_COMPLEX &&
      copied.value?.type === TYPE_SRC &&
      target.blocks.length === 0);

  const canPasteChild = computed(() => canPasteChildToTarget(focused.value));

  const canPasteChildToParent = computed(() =>
    canPasteChildToTarget(focusedParent.value),
  );

  const canPasteParent = computed(() => copied.value?.type === TYPE_SRC);

  const canPaste = computed(() => canPasteChild.value || canPasteParent.value);

  const performPaste = () => {
    if (focused.value) {
      return addChild(deepCopy(copied.value), !isCut.value, true);
    } else {
      return addParent(deepCopy(copied.value), !isCut.value, true);
    }
  };

  const initializeScenes = () => {
    const savedScenes = getSafeLocalStorage("scenes");
    const savedCurrentSceneId = getSafeLocalStorage("currentSceneId");

    if (savedScenes) {
      scenes.value = savedScenes;
      // Load the saved current scene ID if it exists and is valid
      if (
        savedCurrentSceneId &&
        scenes.value.some((scene) => scene.id === savedCurrentSceneId)
      ) {
        currentSceneId.value = savedCurrentSceneId;
      } else if (scenes.value.length > 0) {
        // Fallback to first scene if saved scene ID is invalid
        currentSceneId.value = scenes.value[0].id;
      }
    } else {
      // Check for legacy data first
      const legacyBlocks = getSafeLocalStorage("blocks");
      const legacyExternalBlocks = getSafeLocalStorage("externalSourceBlocks");
      const legacySynthSettings = getSafeLocalStorage("synthSettings");

      if (legacyBlocks || legacyExternalBlocks || legacySynthSettings) {
        convertLegacyData();
      } else {
        // No saved data, create default scene with initial blocks
        const defaultScene = {
          id: generateSceneId(),
          name: "Scene 1",
          blocks: INITIAL_BLOCKS,
          externalSourceBlocks: [],
          synthSettings: {
            output: 0,
            bpm: 120,
            speed: 1,
            resolution: 100,
            fps: 60,
          },
        };

        scenes.value = [defaultScene];
        currentSceneId.value = defaultScene.id;

        saveScenes();

        update();
      }
    }
  };

  const convertLegacyData = () => {
    const legacyBlocks = getSafeLocalStorage("blocks") || [];
    const legacyExternalBlocks =
      getSafeLocalStorage("externalSourceBlocks") || [];
    const legacySynthSettings = getSafeLocalStorage("synthSettings");

    const defaultScene = {
      id: generateSceneId(),
      name: "Scene 1",
      blocks: legacyBlocks,
      externalSourceBlocks: legacyExternalBlocks,
      synthSettings: legacySynthSettings,
    };

    scenes.value = [defaultScene];
    currentSceneId.value = defaultScene.id;

    saveScenes();
  };

  const generateSceneId = () => {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const createScene = (name = null) => {
    let sceneName = null;

    if (name) {
      sceneName = name;
    } else {
      sceneName = `Scene ${scenes.value.length + 1}`;

      let i = 2;
      while (scenes.value.some((scene) => scene.name === sceneName)) {
        sceneName = `Scene ${scenes.value.length + 1} (${i})`;
        i++;
      }
    }

    const newScene = {
      id: generateSceneId(),
      name: sceneName,
      blocks: [],
      externalSourceBlocks: [],
      synthSettings: {
        output: 0,
        bpm: 120,
        speed: 1,
        resolution: 100,
        fps: 60,
      },
    };

    scenes.value.push(newScene);
    // Set the new scene as current and save the current scene ID
    currentSceneId.value = newScene.id;
    setSafeLocalStorage("currentSceneId", newScene.id);

    // Clear the UI blocks to start with a blank scene
    blocks.value.length = 0;
    externalSourceBlocks.value.length = 0;

    // Reset synth settings to defaults
    Object.assign(synthSettings, newScene.synthSettings);

    update({ shouldSetHistory: false });

    return newScene;
  };

  const deleteScene = (sceneId) => {
    const sceneIndex = scenes.value.findIndex((scene) => scene.id === sceneId);
    if (sceneIndex === -1) return false;

    // Don't allow deleting the last scene
    if (scenes.value.length === 1) {
      return false;
    }

    const wasCurrentScene = currentSceneId.value === sceneId;

    scenes.value.splice(sceneIndex, 1);

    if (wasCurrentScene && scenes.value.length > 0) {
      const newCurrentSceneId = scenes.value[0].id;
      currentSceneId.value = newCurrentSceneId;
      // Save the new current scene ID
      setSafeLocalStorage("currentSceneId", newCurrentSceneId);

      // Load the new current scene's data
      const newCurrentScene = scenes.value[0];
      if (newCurrentScene) {
        loadSceneData({
          blocks: newCurrentScene.blocks || [],
          externalSourceBlocks: newCurrentScene.externalSourceBlocks || [],
          synthSettings: newCurrentScene.synthSettings,
        });
      }
    }

    return true;
  };

  const switchToScene = (sceneId) => {
    const scene = scenes.value.find((scene) => scene.id === sceneId);
    if (scene) {
      currentSceneId.value = sceneId;
      setSafeLocalStorage("currentSceneId", sceneId);
      return scene;
    }
    return null;
  };

  const currentScene = computed(() => {
    return (
      scenes.value.find((scene) => scene.id === currentSceneId.value) || null
    );
  });

  const updateCurrentScene = (data) => {
    const scene = currentScene.value;
    if (!scene) return;

    Object.assign(scene, data);
  };

  const saveScenes = () => {
    setSafeLocalStorage("scenes", scenes.value);
  };

  const renameScene = (sceneId, newName) => {
    const scene = scenes.value.find((scene) => scene.id === sceneId);
    if (scene) {
      scene.name = newName;
    }
  };

  return {
    // State
    r,
    g,
    b,
    focused,
    isInputFocused,
    blocks,
    externalSourceBlocks,
    codeString,
    synthSettings,
    history,
    historyIndex,
    canUndo,
    canRedo,
    copied,
    canPaste,
    scenes,
    currentSceneId,
    currentScene,

    // Actions
    updateRGB,
    setFocus,
    setInputFocus,
    addParent,
    addChild,
    setBlocks,
    loadSceneData,
    setBlockPosition,
    setBlockZIndex,
    deleteParent,
    deleteChild,
    update,
    send,
    setSynthSettings,
    setOutput,
    setHistory,
    undoRedo,
    copyBlock,
    pasteBlock,

    // Scene management
    initializeScenes,
    createScene,
    deleteScene,
    switchToScene,
    updateCurrentScene,
    renameScene,
    saveScenes,
  };
});
