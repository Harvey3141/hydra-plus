import { defineAsyncComponent } from "vue";

const modalRegistry = new Map();

export const registerModal = (name, component) => {
  modalRegistry.set(name, component);
};

export const getModalComponent = (name) => {
  return modalRegistry.get(name);
};

export const getAllModals = () => {
  return Object.fromEntries(modalRegistry);
};

export const isModalRegistered = (name) => {
  return modalRegistry.has(name);
};

export const initializeModalRegistry = () => {
  registerModal(
    "welcome",
    defineAsyncComponent(() => import("@/components/modal/WelcomeModal")),
  );
  registerModal(
    "addBlock",
    defineAsyncComponent(() => import("@/components/modal/AddBlockModal")),
  );
  registerModal(
    "three",
    defineAsyncComponent(() => import("@/components/modal/ThreeModal")),
  );
  registerModal(
    "settings",
    defineAsyncComponent(() => import("@/components/modal/SettingsModal")),
  );
  registerModal(
    "renameScene",
    defineAsyncComponent(() => import("@/components/modal/RenameSceneModal")),
  );
};

export default {
  registerModal,
  getModalComponent,
  getAllModals,
  isModalRegistered,
  initializeModalRegistry,
};
